import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const materialSchema = z.object({
  materialId: z.string().nullable(),
  materialName: z.string().min(1),
  contentText: z.string(),
  uploadType: z.string(),
  wordCount: z.number().int().nonnegative(),
});

async function assertActiveTester(testerCode: string) {
  const { data, error } = await supabase
    .from("tester_profiles")
    .select("tester_code, is_active")
    .eq("tester_code", testerCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Auth check error:", error);
    throw new Error("Your tester code is no longer active.");
  }
  if (!data) throw new Error("Your tester code is no longer active.");
}

/** Starts a new study session. Queries Supabase directly from the client. */
export async function startSession(input: {
  testerCode: string;
  materialId: string | null;
  sessionMode: "learning" | "study";
}): Promise<{ sessionId: string }> {
  const data = z
    .object({
      testerCode: z.string().min(1),
      materialId: z.string().nullable(),
      sessionMode: z.enum(["learning", "study"]),
    })
    .parse(input);

  try {
    await assertActiveTester(data.testerCode);

    const { data: row, error } = await supabase
      .from("sessions")
      .insert({
        tester_code: data.testerCode,
        material_id: data.materialId,
        session_mode: data.sessionMode,
        started_at: new Date().toISOString(),
        status: "active",
        message_count: 0,
      })
      .select("session_id")
      .single();

    if (error) {
      console.error("Session start error:", error);
      throw new Error("Could not start session");
    }
    return { sessionId: row.session_id };
  } catch (e) {
    if (e instanceof Error && e.message === "Could not start session") throw e;
    if (e instanceof Error && e.message === "Your tester code is no longer active.") throw e;
    console.error("Session start error:", e);
    throw new Error("Could not start session");
  }
}

/** Loads the session chat history and linked material. Queries Supabase directly from the client. */
export async function getSessionChat(input: {
  testerCode: string;
  sessionId: string;
  fallbackMaterial?: z.infer<typeof materialSchema>;
}) {
  const data = z
    .object({
      testerCode: z.string().min(1),
      sessionId: z.string().uuid(),
      fallbackMaterial: materialSchema.optional(),
    })
    .parse(input);

  await assertActiveTester(data.testerCode);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "session_id, session_mode, started_at, status, material_id, materials(material_name, content_text, upload_type, word_count)",
    )
    .eq("session_id", data.sessionId)
    .eq("tester_code", data.testerCode)
    .eq("status", "active")
    .maybeSingle();
  if (sessionError || !session) throw new Error("This session is no longer active.");

  const { data: rows, error: messagesError } = await supabase
    .from("messages")
    .select(
      "message_id, role, content, timestamp, feedback_tag, verify_flag, predict_concept, page_reference",
    )
    .eq("session_id", data.sessionId)
    .order("timestamp", { ascending: true })
    .order("message_id", { ascending: true });
  if (messagesError) throw new Error("Could not load this conversation.");

  const linkedMaterial = Array.isArray(session.materials)
    ? session.materials[0]
    : session.materials;
  const savedMaterial = linkedMaterial?.content_text
    ? {
        materialId: session.material_id,
        materialName: linkedMaterial.material_name ?? data.fallbackMaterial?.materialName ?? "Study material",
        contentText: linkedMaterial.content_text,
        uploadType: linkedMaterial.upload_type ?? data.fallbackMaterial?.uploadType ?? "",
        wordCount: linkedMaterial.word_count ?? data.fallbackMaterial?.wordCount ?? 0,
      }
    : null;
  const material = savedMaterial ?? (session.material_id === null ? data.fallbackMaterial : null);
  if (!material) throw new Error("The study material for this session is unavailable.");

  return {
    session: {
      sessionId: session.session_id,
      sessionMode: session.session_mode === "study" ? ("study" as const) : ("learning" as const),
      startedAt: session.started_at,
      material,
    },
    messages: (rows ?? []).map((row) => ({
      id: row.message_id,
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
      timestamp: row.timestamp,
      feedbackTag: row.feedback_tag,
      verifyFlag: row.verify_flag,
      predictConcept: row.predict_concept,
      pageReference: row.page_reference,
    })),
  };
}

/** Saves the confidence rating and returns the tester's group assignment. */
export async function setConfidence(input: {
  testerCode: string;
  sessionId: string;
  confidenceRating: "still_confused" | "getting_there" | "i_get_it";
}): Promise<{ groupAssignment: string | null }> {
  const data = z
    .object({
      testerCode: z.string().min(1),
      sessionId: z.string().uuid(),
      confidenceRating: z.enum(["still_confused", "getting_there", "i_get_it"]),
    })
    .parse(input);

  const { error } = await supabase
    .from("sessions")
    .update({ confidence_rating: data.confidenceRating })
    .eq("session_id", data.sessionId)
    .eq("tester_code", data.testerCode);
  if (error) {
    console.error("Confidence save error:", error);
    throw new Error("Could not save your confidence rating. Please try again.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("tester_profiles")
    .select("group_assignment")
    .eq("tester_code", data.testerCode)
    .maybeSingle();
  if (profileError) console.error("Profile lookup error:", profileError);
  return { groupAssignment: profile?.group_assignment ?? null };
}

/** Marks a session as completed and records its duration. */
export async function endSession(input: {
  testerCode: string;
  sessionId: string;
}): Promise<{ ok: true }> {
  const data = z
    .object({ testerCode: z.string().min(1), sessionId: z.string().uuid() })
    .parse(input);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("session_id", data.sessionId)
    .eq("tester_code", data.testerCode)
    .eq("status", "active")
    .maybeSingle();
  if (sessionError || !session) throw new Error("This session has already ended.");

  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - Date.parse(session.started_at)) / 1000),
  );
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("session_id", data.sessionId)
    .eq("tester_code", data.testerCode)
    .eq("status", "active");
  if (error) {
    console.error("End session error:", error);
    throw new Error("Could not end this session. Please try again.");
  }
  return { ok: true as const };
}
