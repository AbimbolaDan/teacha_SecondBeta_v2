import { supabase } from "@/integrations/supabase/client";

export type AdminSession = {
  session_id: string;
  tester_code: string | null;
  session_mode: string | null;
  status: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  message_count: number | null;
  confidence_rating: string | null;
  material_id: string | null;
  material_name: string | null;
  group_assignment: string | null;
  has_uncertain: boolean;
  has_predict: boolean;
  predict_concept: string | null;
};

export type AdminMessage = {
  message_id: string;
  role: string | null;
  content: string;
  timestamp: string;
  feedback_tag: string | null;
  verify_flag: string | null;
  predict_concept: string | null;
  page_reference: number | null;
};

export type AdminAssessment = {
  mastery_event_id: string;
  assessment_question: string | null;
  student_answer: string | null;
  wunmi_evaluation: string | null;
  concept_name: string | null;
};

export type ApiUsageRow = {
  date: string;
  api_calls: number | null;
  concept_extraction_calls: number | null;
  assessment_generation_calls: number | null;
};

export type AdminMaterial = {
  material_id: string;
  tester_code: string | null;
  material_name: string;
  upload_type: string | null;
  word_count: number | null;
  created_at: string;
  session_count: number;
  concepts: string[];
};

export async function fetchAllSessions(): Promise<AdminSession[]> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(
      "session_id, tester_code, session_mode, status, started_at, ended_at, duration_seconds, message_count, confidence_rating, material_id, materials(material_name)",
    )
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Admin: fetch sessions error:", error);
    throw new Error("Could not load sessions.");
  }

  const testerCodes = [...new Set((sessions ?? []).map((s) => s.tester_code).filter(Boolean))] as string[];
  let groupMap: Record<string, string | null> = {};
  if (testerCodes.length > 0) {
    const { data: profiles } = await supabase
      .from("tester_profiles")
      .select("tester_code, group_assignment")
      .in("tester_code", testerCodes);
    for (const p of profiles ?? []) {
      groupMap[p.tester_code] = p.group_assignment;
    }
  }

  const sessionIds = (sessions ?? []).map((s) => s.session_id);
  const { data: msgFlags } = await supabase
    .from("messages")
    .select("session_id, verify_flag, predict_concept")
    .in("session_id", sessionIds);

  const flagMap: Record<string, { has_uncertain: boolean; has_predict: boolean; predict_concept: string | null }> = {};
  for (const m of msgFlags ?? []) {
    if (!m.session_id) continue;
    if (!flagMap[m.session_id]) flagMap[m.session_id] = { has_uncertain: false, has_predict: false, predict_concept: null };
    if (m.verify_flag === "uncertain") flagMap[m.session_id].has_uncertain = true;
    if (m.predict_concept) {
      flagMap[m.session_id].has_predict = true;
      flagMap[m.session_id].predict_concept = m.predict_concept;
    }
  }

  return (sessions ?? []).map((s) => {
    const linkedMaterial = Array.isArray(s.materials) ? s.materials[0] : s.materials;
    const flags = flagMap[s.session_id] ?? { has_uncertain: false, has_predict: false, predict_concept: null };
    return {
      session_id: s.session_id,
      tester_code: s.tester_code,
      session_mode: s.session_mode,
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_seconds: s.duration_seconds,
      message_count: s.message_count,
      confidence_rating: s.confidence_rating,
      material_id: s.material_id,
      material_name: linkedMaterial?.material_name ?? null,
      group_assignment: s.tester_code ? (groupMap[s.tester_code] ?? null) : null,
      has_uncertain: flags.has_uncertain,
      has_predict: flags.has_predict,
      predict_concept: flags.predict_concept,
    };
  });
}

export async function fetchSessionTranscript(sessionId: string): Promise<{
  messages: AdminMessage[];
  assessments: AdminAssessment[];
}> {
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select(
      "message_id, role, content, timestamp, feedback_tag, verify_flag, predict_concept, page_reference",
    )
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true })
    .order("message_id", { ascending: true });

  if (msgError) {
    console.error("Admin: fetch transcript error:", msgError);
    throw new Error("Could not load transcript.");
  }

  const { data: assessments } = await supabase
    .from("mastery_events")
    .select("mastery_event_id, assessment_question, student_answer, wunmi_evaluation, concept_name")
    .eq("session_id", sessionId)
    .eq("event_type", "assessment")
    .order("event_timestamp", { ascending: true });

  return {
    messages: (messages ?? []) as AdminMessage[],
    assessments: (assessments ?? []) as AdminAssessment[],
  };
}

export async function fetchApiUsage(): Promise<ApiUsageRow[]> {
  const { data, error } = await supabase
    .from("api_usage")
    .select("date, api_calls, concept_extraction_calls, assessment_generation_calls")
    .order("date", { ascending: false })
    .limit(14);

  if (error) {
    console.error("Admin: fetch api_usage error:", error);
    throw new Error("Could not load API usage data.");
  }

  return (data ?? []) as ApiUsageRow[];
}

export async function fetchAllMaterials(): Promise<AdminMaterial[]> {
  const { data: materials, error } = await supabase
    .from("materials")
    .select("material_id, tester_code, material_name, upload_type, word_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin: fetch materials error:", error);
    throw new Error("Could not load materials.");
  }

  const materialIds = (materials ?? []).map((m) => m.material_id);

  const { count: sessionCounts, error: scError } = await supabase
    .from("sessions")
    .select("material_id", { count: "exact", head: true })
    .in("material_id", materialIds);

  // We need per-material counts, so do a grouped query
  let perMaterialCounts: Record<string, number> = {};
  if (materialIds.length > 0) {
    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("material_id")
      .in("material_id", materialIds)
      .not("material_id", "is", null);
    for (const row of sessionRows ?? []) {
      if (row.material_id) {
        perMaterialCounts[row.material_id] = (perMaterialCounts[row.material_id] ?? 0) + 1;
      }
    }
  }

  let perMaterialConcepts: Record<string, string[]> = {};
  if (materialIds.length > 0) {
    const { data: coverage } = await supabase
      .from("concept_coverage")
      .select("material_id, concept_name")
      .in("material_id", materialIds);
    for (const c of coverage ?? []) {
      if (!c.material_id) continue;
      if (!perMaterialConcepts[c.material_id]) perMaterialConcepts[c.material_id] = [];
      if (c.concept_name && !perMaterialConcepts[c.material_id].includes(c.concept_name)) {
        perMaterialConcepts[c.material_id].push(c.concept_name);
      }
    }
  }

  return (materials ?? []).map((m) => ({
    material_id: m.material_id,
    tester_code: m.tester_code,
    material_name: m.material_name,
    upload_type: m.upload_type,
    word_count: m.word_count,
    created_at: m.created_at,
    session_count: perMaterialCounts[m.material_id] ?? 0,
    concepts: perMaterialConcepts[m.material_id] ?? [],
  }));
}
