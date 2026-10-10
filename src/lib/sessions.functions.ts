import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const materialSchema = z.object({
  materialId: z.string().nullable(),
  materialName: z.string().min(1),
  contentText: z.string(),
  uploadType: z.string(),
  wordCount: z.number().int().nonnegative(),
});

async function getActiveTester(testerCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tester_profiles")
    .select("tester_code, is_active")
    .eq("tester_code", testerCode)
    .maybeSingle();
  if (error || !data?.is_active) throw new Error("Your tester code is no longer active.");
  return supabaseAdmin;
}

export const startSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        materialId: z.string().nullable(),
        sessionMode: z.enum(["learning", "study"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getActiveTester(data.testerCode);
    const { data: row, error } = await db
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
    if (error) throw new Error("Could not start session");
    return { sessionId: row.session_id };
  });

export const getSessionChat = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        sessionId: z.string().uuid(),
        fallbackMaterial: materialSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getActiveTester(data.testerCode);
    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("session_id, session_mode, started_at, status, material_id, materials(material_name, content_text, upload_type, word_count)")
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode)
      .eq("status", "active")
      .maybeSingle();
    if (sessionError || !session) throw new Error("This session is no longer active.");

    const { data: rows, error: messagesError } = await db
      .from("messages")
      .select("message_id, role, content, timestamp, feedback_tag, verify_flag, predict_concept, page_reference")
      .eq("session_id", data.sessionId)
      .order("timestamp", { ascending: true })
      .order("message_id", { ascending: true });
    if (messagesError) throw new Error("Could not load this conversation.");

    const linkedMaterial = Array.isArray(session.materials) ? session.materials[0] : session.materials;
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
        sessionMode: session.session_mode === "study" ? "study" as const : "learning" as const,
        startedAt: session.started_at,
        material,
      },
      messages: (rows ?? []).map((row) => ({
        id: row.message_id,
        role: row.role === "assistant" ? "assistant" as const : "user" as const,
        content: row.content,
        timestamp: row.timestamp,
        feedbackTag: row.feedback_tag,
        verifyFlag: row.verify_flag,
        predictConcept: row.predict_concept,
        pageReference: row.page_reference,
      })),
    };
  });

export const setConfidence = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        sessionId: z.string().uuid(),
        confidenceRating: z.enum(["still_confused", "getting_there", "i_get_it"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getActiveTester(data.testerCode);
    const { error } = await db
      .from("sessions")
      .update({ confidence_rating: data.confidenceRating })
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode);
    if (error) throw new Error("Could not save your confidence rating. Please try again.");

    const { data: profile } = await db
      .from("tester_profiles")
      .select("group_assignment")
      .eq("tester_code", data.testerCode)
      .maybeSingle();
    return { groupAssignment: profile?.group_assignment ?? null };
  });

export const endSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ testerCode: z.string().min(1), sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getActiveTester(data.testerCode);
    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("started_at")
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode)
      .eq("status", "active")
      .maybeSingle();
    if (sessionError || !session) throw new Error("This session has already ended.");

    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - Date.parse(session.started_at)) / 1000));
    const { error } = await db
      .from("sessions")
      .update({ status: "completed", ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode)
      .eq("status", "active");
    if (error) throw new Error("Could not end this session. Please try again.");
    return { ok: true as const };
  });