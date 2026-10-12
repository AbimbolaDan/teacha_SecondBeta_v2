import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { supabase } from "@/integrations/supabase/client";
import { buildSessionContext, GEMINI_MODEL, HISTORY_WINDOW } from "./wunmi.server";
import { cleanWunmiResponse } from "./wunmi-clean";
import { WUNMI_SYSTEM_PROMPT } from "./wunmi-prompt";

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

type SendWunmiInput = {
  testerCode: string;
  sessionId: string | null;
  sessionMode: "learning" | "study";
  materialName: string;
  materialContent: string;
  history: { role: "user" | "assistant"; content: string }[];
};

/**
 * Client-side Wunmi message handler.
 * Calls the Gemini API directly from the browser and persists messages via Supabase.
 */
export async function sendWunmiMessage(input: SendWunmiInput): Promise<{ reply: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined);
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is not configured");
    throw new Error("Wunmi could not respond right now. Please try again.");
  }

  // 1. Verify tester is active
  const { data: profile, error: profileError } = await supabase
    .from("tester_profiles")
    .select("name, course, year_level, is_active")
    .eq("tester_code", input.testerCode)
    .maybeSingle();
  if (profileError) console.error("Profile lookup error:", profileError);
  if (!profile?.is_active) throw new Error("Your tester code is no longer active.");

  const sessionId = input.sessionId ?? null;
  let previousAssistantContent: string | null = null;
  let previousTimestamp: string | null = null;

  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .eq("tester_code", input.testerCode)
      .eq("status", "active")
      .maybeSingle();
    if (sessionError) console.error("Session check error:", sessionError);
    if (!session) throw new Error("This session is no longer active.");

    const { data: lastRows, error: lastError } = await supabase
      .from("messages")
      .select("role, content, timestamp")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: false })
      .order("message_id", { ascending: false })
      .limit(1);
    if (lastError) console.error("Last message lookup error:", lastError);
    const last = lastRows?.[0];
    if (last) {
      previousTimestamp = last.timestamp;
      if (last.role === "assistant") previousAssistantContent = last.content;
    }
  }

  // 2. Persist the student's message
  const studentContent = input.history[input.history.length - 1]!.content;
  const { messageType, isStudentInitiated } = classifyStudentMessage(
    studentContent,
    previousAssistantContent,
  );
  const secondsSincePrevious = previousTimestamp
    ? Math.max(0, Math.floor((Date.now() - Date.parse(previousTimestamp)) / 1000))
    : null;

  if (sessionId) {
    const { error: msgError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: studentContent,
      message_type: messageType,
      is_student_initiated: isStudentInitiated,
      seconds_since_previous: secondsSincePrevious,
    });
    if (msgError) console.error("Student message insert failed:", msgError);
  }

  // 3. Fetch past sessions for context
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("session_id, confidence_rating, materials(material_name)")
    .eq("tester_code", input.testerCode)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(3);
  if (sessionsError) console.error("Past sessions error:", sessionsError);

  const ids = (sessions ?? []).map((s) => s.session_id);
  let coverage: { session_id: string | null; concept_name: string }[] = [];
  if (ids.length > 0) {
    const { data: coverageData, error: coverageError } = await supabase
      .from("concept_coverage")
      .select("session_id, concept_name")
      .in("session_id", ids);
    if (coverageError) console.error("Coverage error:", coverageError);
    coverage = coverageData ?? [];
  }

  const pastSessions = (sessions ?? []).map((s) => {
    const linkedMaterial = Array.isArray(s.materials) ? s.materials[0] : s.materials;
    return {
      materialName: linkedMaterial?.material_name ?? "Untitled material",
      confidenceRating: s.confidence_rating,
      concepts: coverage.filter((c) => c.session_id === s.session_id).map((c) => c.concept_name),
    };
  });

  // 4. Build context and call Gemini
  const ctx = buildSessionContext({
    profile: {
      name: profile.name,
      course: profile.course,
      year_level: profile.year_level,
    },
    materialName: input.materialName,
    materialContent: input.materialContent,
    sessionMode: input.sessionMode,
    pastSessions,
    history: input.history,
  });

  let rawReply: string;
  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: WUNMI_SYSTEM_PROMPT,
    });
    const result = await model.generateContent({ contents: ctx.contents });
    rawReply = result.response.text();
  } catch (e) {
    console.error("Gemini call failed:", e);
    throw new Error("Wunmi could not respond right now. Please try again.");
  }

  if (!rawReply || !rawReply.trim()) {
    console.error("Gemini returned empty response");
    throw new Error("Wunmi could not respond right now. Please try again.");
  }

  // 5. Clean and persist the assistant reply
  const cleaned = cleanWunmiResponse(rawReply);

  if (sessionId && cleaned.misconception_concepts.length) {
    const { error: misError } = await supabase.from("misconception_events").insert(
      cleaned.misconception_concepts.map((c) => ({
        session_id: sessionId,
        tester_code: input.testerCode,
        misconception_concept: c,
        wunmi_correction: cleaned.content,
      })),
    );
    if (misError) console.error("Misconception insert failed:", misError);
  }

  if (sessionId) {
    const { error: msgError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: cleaned.content,
      feedback_tag: cleaned.feedback_tag,
      verify_flag: cleaned.verify_flag,
      predict_concept: cleaned.predict_concept,
      page_reference: cleaned.page_reference,
    });
    if (msgError) console.error("Message insert failed:", msgError);

    const { count, error: countError } = await supabase
      .from("messages")
      .select("message_id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (countError) console.error("Message count error:", countError);
    await supabase
      .from("sessions")
      .update({ message_count: count ?? 0 })
      .eq("session_id", sessionId);
  }

  // 6. Increment API usage counter
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("api_usage")
    .select("api_calls")
    .eq("date", today)
    .maybeSingle();
  await supabase
    .from("api_usage")
    .upsert({ date: today, api_calls: (usage?.api_calls ?? 0) + 1 }, { onConflict: "date" });

  return { reply: cleaned.content };
}

// Re-export for any external consumers
export { GEMINI_MODEL, HISTORY_WINDOW, buildSessionContext };
export type { Content };
