import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const REDIRECT_PHRASES = [
  "skip this",
  "move on",
  "i already know",
  "i understand this",
  "what about",
  "hold on",
  "never mind",
];
const CONFIRMATION_PHRASES = ["yes", "okay", "got it", "i see", "understood", "sure"];

/** Classifies a student message per the study's behaviour rules. */
export function classifyStudentMessage(
  content: string,
  previousAssistantContent: string | null,
): { messageType: string; isStudentInitiated: boolean } {
  const isStudentInitiated = previousAssistantContent
    ? !previousAssistantContent.trimEnd().includes("?")
    : true;
  const text = content.trim();
  const lower = text.toLowerCase();
  let messageType = "response";
  if (text.includes("?") && text.length > 15) messageType = "question";
  else if (REDIRECT_PHRASES.some((p) => lower.includes(p))) messageType = "redirect";
  else if (text.split(/\s+/).length <= 5 && CONFIRMATION_PHRASES.some((p) => lower.includes(p)))
    messageType = "confirmation";
  return { messageType, isStudentInitiated };
}

export const sendWunmiMessage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        sessionId: z.string().uuid().nullable().optional(),
        sessionMode: z.enum(["learning", "study"]),
        materialName: z.string(),
        materialContent: z.string(),
        // Full conversation so far, ending with the student's latest message.
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { buildSessionContext, callGemini } = await import("./wunmi.server");

    const { data: profile } = await db
      .from("tester_profiles")
      .select("name, course, year_level, is_active")
      .eq("tester_code", data.testerCode)
      .maybeSingle();
    if (!profile?.is_active) throw new Error("Invalid tester code");

    const sessionId = data.sessionId ?? null;
    let previousAssistantContent: string | null = null;
    let previousTimestamp: string | null = null;

    if (sessionId) {
      const { data: session } = await db
        .from("sessions")
        .select("session_id")
        .eq("session_id", sessionId)
        .eq("tester_code", data.testerCode)
        .eq("status", "active")
        .maybeSingle();
      if (!session) throw new Error("This session is no longer active.");

      const { data: lastRows } = await db
        .from("messages")
        .select("role, content, timestamp")
        .eq("session_id", sessionId)
        .order("timestamp", { ascending: false })
        .order("message_id", { ascending: false })
        .limit(1);
      const last = lastRows?.[0];
      if (last) {
        previousTimestamp = last.timestamp;
        if (last.role === "assistant") previousAssistantContent = last.content;
      }
    }

    // Persist the student's message with its behaviour metadata.
    const studentContent = data.history[data.history.length - 1]!.content;
    const { messageType, isStudentInitiated } = classifyStudentMessage(
      studentContent,
      previousAssistantContent,
    );
    const secondsSincePrevious = previousTimestamp
      ? Math.max(0, Math.floor((Date.now() - Date.parse(previousTimestamp)) / 1000))
      : null;

    if (sessionId) {
      const { error } = await db.from("messages").insert({
        session_id: sessionId,
        role: "user",
        content: studentContent,
        message_type: messageType,
        is_student_initiated: isStudentInitiated,
        seconds_since_previous: secondsSincePrevious,
      });
      if (error) console.error("student message insert failed", error);
    }

    const { data: sessions } = await db
      .from("sessions")
      .select("session_id, confidence_rating, materials(name)")
      .eq("tester_code", data.testerCode)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(3);
    const ids = (sessions ?? []).map((s) => s.session_id);
    const { data: coverage } = ids.length
      ? await db.from("concept_coverage").select("session_id, concept_name").in("session_id", ids)
      : { data: [] as { session_id: string | null; concept_name: string }[] };

    const pastSessions = (sessions ?? []).map((s) => ({
      materialName: (s.materials as { name?: string } | null)?.name ?? "Untitled material",
      confidenceRating: s.confidence_rating,
      concepts: (coverage ?? []).filter((c) => c.session_id === s.session_id).map((c) => c.concept_name),
    }));

    const ctx = buildSessionContext({
      profile,
      materialName: data.materialName,
      materialContent: data.materialContent,
      sessionMode: data.sessionMode,
      pastSessions,
      history: data.history,
    });

    let reply: string;
    try {
      reply = await callGemini(ctx);
    } catch (e) {
      console.error("Gemini call failed", e);
      throw new Error("Wunmi could not respond right now. Please try again.");
    }

    // Increment today's api_calls counter (upsert on date).
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await db.from("api_usage").select("api_calls").eq("date", today).maybeSingle();
    await db
      .from("api_usage")
      .upsert({ date: today, api_calls: (usage?.api_calls ?? 0) + 1 }, { onConflict: "date" });

    // Clean markers, log misconceptions, store the assistant message.
    const { cleanWunmiResponse } = await import("./wunmi-clean");
    const cleaned = cleanWunmiResponse(reply);

    if (sessionId && cleaned.misconception_concepts.length) {
      const { error } = await db.from("misconception_events").insert(
        cleaned.misconception_concepts.map((c) => ({
          session_id: sessionId,
          tester_code: data.testerCode,
          misconception_concept: c,
          wunmi_correction: cleaned.content,
        })),
      );
      if (error) console.error("misconception insert failed", error);
    }

    if (sessionId) {
      const { error } = await db.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: cleaned.content,
        feedback_tag: cleaned.feedback_tag,
        verify_flag: cleaned.verify_flag,
        predict_concept: cleaned.predict_concept,
        page_reference: cleaned.page_reference,
      });
      if (error) console.error("message insert failed", error);

      // Update the session's message count after the exchange.
      const { count } = await db
        .from("messages")
        .select("message_id", { count: "exact", head: true })
        .eq("session_id", sessionId);
      await db
        .from("sessions")
        .update({ message_count: count ?? 0 })
        .eq("session_id", sessionId);
    }

    return { reply: cleaned.content };
  });
