import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CONCEPT_PROMPT =
  "List the main concepts that were taught in this session as short descriptive phrases. Give between three and eight concepts. One concept per line. Nothing else in your response.";

/** Rough heuristic: main subject noun phrase from the last sentence. */
function extractConceptFromMessage(content: string): string {
  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = sentences[sentences.length - 1] ?? content;
  const words = last.replace(/^[^A-Za-z]+/, "").split(/\s+/);
  // Skip common leading verbs/pronouns to approximate the subject noun.
  const skip = new Set([
    "you", "your", "yours", "this", "that", "these", "those", "it", "its",
    "the", "a", "an", "so", "now", "yes", "no", "well", "good", "great",
    "exactly", "correct", "right", "not", "quite", "almost", "there",
  ]);
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z'-]/g, "");
    if (!clean) continue;
    if (picked.length === 0 && skip.has(clean.toLowerCase())) continue;
    picked.push(clean);
    if (picked.length >= 3) break;
  }
  return picked.join(" ") || "general understanding";
}

export const processSessionEnd = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ testerCode: z.string().min(1), sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("session_id, tester_code, material_id")
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode)
      .maybeSingle();
    if (!session) return { ok: false as const };

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("role, content, feedback_tag, timestamp")
      .eq("session_id", data.sessionId)
      .order("timestamp", { ascending: true });

    const messages = rows ?? [];

    // 1. Concept extraction from the full transcript.
    if (messages.length > 0) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const key = process.env["GEMINI_API_KEY"];
        if (key) {
          const transcript = messages
            .map((m) => `${m.role === "assistant" ? "Wunmi" : "Student"}: ${m.content}`)
            .join("\n\n");
          const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-3.0-flash" });
          const result = await model.generateContent(
            `Here is the full transcript of a tutoring session:\n\n${transcript}\n\n${CONCEPT_PROMPT}`,
          );
          const concepts = result.response
            .text()
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          if (concepts.length > 0) {
            await supabaseAdmin.from("concept_coverage").insert(
              concepts.map((concept) => ({
                session_id: data.sessionId,
                tester_code: data.testerCode,
                material_id: session.material_id,
                concept_name: concept,
              })),
            );
          }
          await supabaseAdmin
            .from("api_usage")
            .upsert(
              { date: today, concept_extraction_calls: 1 },
              { onConflict: "date", ignoreDuplicates: true },
            );
          const { data: current } = await supabaseAdmin
            .from("api_usage")
            .select("concept_extraction_calls")
            .eq("date", today)
            .maybeSingle();
          await supabaseAdmin
            .from("api_usage")
            .update({ concept_extraction_calls: (current?.concept_extraction_calls ?? 0) + 1 })
            .eq("date", today);
        }
      } catch {
        // Concept extraction is best-effort; never block the student.
      }
    }

    // 2. Mastery events from messages carrying a feedback tag.
    const feedbackRows = messages.filter((m) => m.feedback_tag);
    if (feedbackRows.length > 0) {
      await supabaseAdmin.from("mastery_events").insert(
        feedbackRows.map((m) => ({
          session_id: data.sessionId,
          tester_code: data.testerCode,
          event_type: "feedback",
          feedback_result: m.feedback_tag,
          concept_name: extractConceptFromMessage(m.content),
        })),
      );
    }

    return { ok: true as const };
  });
