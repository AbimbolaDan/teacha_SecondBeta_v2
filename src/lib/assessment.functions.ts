import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QUESTIONS_PROMPT =
  "Generate exactly three questions based on what was taught in this session. The first question must test recall — the student can answer it by remembering a specific fact or definition from the session. The second question must test comprehension — the student must demonstrate they understand why something works, not just that it does. The third question must test application — the student must apply a concept to a new scenario they have not seen exactly before. Return only the three questions as a numbered list, nothing else.";

const EVALUATION_PROMPT =
  "Evaluate this student answer to this health science question in one sentence. State whether it is correct, partially correct naming the specific gap, or incorrect naming the right direction. One sentence only.";

async function getDb(testerCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("tester_profiles")
    .select("is_active, group_assignment")
    .eq("tester_code", testerCode)
    .maybeSingle();
  if (!profile?.is_active) throw new Error("Your tester code is no longer active.");
  return { supabaseAdmin, groupAssignment: profile.group_assignment ?? null };
}

async function incrementAssessmentCalls(supabaseAdmin: any) {
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin
    .from("api_usage")
    .upsert({ date: today, assessment_generation_calls: 1 }, { onConflict: "date", ignoreDuplicates: true });
  const { data: current } = await supabaseAdmin
    .from("api_usage")
    .select("assessment_generation_calls")
    .eq("date", today)
    .maybeSingle();
  await supabaseAdmin
    .from("api_usage")
    .update({ assessment_generation_calls: (current?.assessment_generation_calls ?? 0) + 1 })
    .eq("date", today);
}

function extractConceptFromQuestion(question: string): string {
  const words = question.replace(/^[0-9]+[.)]\s*/, "").replace(/\?$/, "").split(/\s+/);
  const skip = new Set([
    "what", "why", "how", "which", "when", "where", "who", "explain", "describe",
    "define", "name", "list", "state", "is", "are", "does", "do", "the", "a", "an",
  ]);
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^A-Za-z'-]/g, "");
    if (!clean) continue;
    if (picked.length === 0 && skip.has(clean.toLowerCase())) continue;
    picked.push(clean);
    if (picked.length >= 4) break;
  }
  return picked.join(" ") || "session concepts";
}

export const generateAssessment = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ testerCode: z.string().min(1), sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, groupAssignment } = await getDb(data.testerCode);
    if (groupAssignment !== "B") throw new Error("This assessment is only for Group B testers.");

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("material_id, materials(content_text)")
      .eq("session_id", data.sessionId)
      .eq("tester_code", data.testerCode)
      .maybeSingle();
    if (!session) throw new Error("This session could not be found.");

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("role, content, timestamp")
      .eq("session_id", data.sessionId)
      .order("timestamp", { ascending: true });
    const messages = rows ?? [];
    if (messages.length === 0) throw new Error("This session has no conversation to assess.");

    const linkedMaterial = Array.isArray(session.materials) ? session.materials[0] : session.materials;
    const materialText: string = linkedMaterial?.content_text ?? "";
    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "Wunmi" : "Student"}: ${m.content}`)
      .join("\n\n");

    const key = process.env["GEMINI_API_KEY"];
    if (!key) throw new Error("The assessment service is not configured.");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-3.0-flash" });
    const context = [
      materialText ? `Uploaded material:\n${materialText.slice(0, 20000)}` : null,
      `Session transcript:\n${transcript}`,
      QUESTIONS_PROMPT,
    ]
      .filter(Boolean)
      .join("\n\n");
    const result = await model.generateContent(context);
    const text = result.response.text();

    // Split on numbered list markers (1. / 2. / 3. or 1) style).
    const parts = text
      .split(/(?:^|\n)\s*\d+\s*[.)]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const questions = parts.slice(0, 3);
    if (questions.length < 3) throw new Error("Could not prepare your assessment. Please try again.");

    await incrementAssessmentCalls(supabaseAdmin);
    return { questions };
  });

export const submitAssessmentAnswer = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        sessionId: z.string().uuid(),
        question: z.string().min(1),
        answer: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, groupAssignment } = await getDb(data.testerCode);
    if (groupAssignment !== "B") throw new Error("This assessment is only for Group B testers.");

    const key = process.env["GEMINI_API_KEY"];
    if (!key) throw new Error("The assessment service is not configured.");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-3.0-flash" });
    const result = await model.generateContent(
      `Question: ${data.question}\n\nStudent's answer: ${data.answer}\n\n${EVALUATION_PROMPT}`,
    );
    const evaluation = result.response.text().trim();

    await supabaseAdmin.from("mastery_events").insert({
      session_id: data.sessionId,
      tester_code: data.testerCode,
      event_type: "assessment",
      assessment_question: data.question,
      student_answer: data.answer,
      wunmi_evaluation: evaluation,
      concept_name: extractConceptFromQuestion(data.question),
    });

    return { evaluation };
  });
