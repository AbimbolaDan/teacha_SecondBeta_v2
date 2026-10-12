import { supabase } from "@/integrations/supabase/client";

export type ProfileData = {
  name: string;
  course: string;
  year_level: string;
  institution: string | null;
  tester_code: string;
};

export type SessionHistoryItem = {
  session_id: string;
  material_name: string | null;
  session_mode: string | null;
  duration_seconds: number | null;
  started_at: string;
  confidence_rating: string | null;
};

export type MaterialWithConcepts = {
  material_id: string;
  material_name: string;
  concepts: string[];
};

/** Fetches the tester's profile, all completed sessions, and materials with concept coverage. */
export async function fetchProfileBoard(testerCode: string): Promise<{
  profile: ProfileData | null;
  sessions: SessionHistoryItem[];
  materials: MaterialWithConcepts[];
}> {
  const [profileResult, sessionsResult, materialsResult] = await Promise.all([
    supabase
      .from("tester_profiles")
      .select("name, course, year_level, institution, tester_code")
      .eq("tester_code", testerCode)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select(
        "session_id, material_id, session_mode, duration_seconds, started_at, confidence_rating, materials(material_name)",
      )
      .eq("tester_code", testerCode)
      .eq("status", "completed")
      .order("started_at", { ascending: false }),
    supabase
      .from("materials")
      .select("material_id, material_name")
      .eq("tester_code", testerCode)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) console.error("Profile fetch error:", profileResult.error);
  if (sessionsResult.error) console.error("Sessions fetch error:", sessionsResult.error);
  if (materialsResult.error) console.error("Materials fetch error:", materialsResult.error);

  const profile = profileResult.data
    ? {
        name: profileResult.data.name,
        course: profileResult.data.course,
        year_level: profileResult.data.year_level,
        institution: profileResult.data.institution,
        tester_code: profileResult.data.tester_code,
      }
    : null;

  const sessions: SessionHistoryItem[] = (sessionsResult.data ?? []).map((s) => {
    const linkedMaterial = Array.isArray(s.materials) ? s.materials[0] : s.materials;
    return {
      session_id: s.session_id,
      material_name: linkedMaterial?.material_name ?? null,
      session_mode: s.session_mode,
      duration_seconds: s.duration_seconds,
      started_at: s.started_at,
      confidence_rating: s.confidence_rating,
    };
  });

  const materials: MaterialWithConcepts[] = [];
  for (const m of materialsResult.data ?? []) {
    const { data: concepts, error: conceptError } = await supabase
      .from("concept_coverage")
      .select("concept_name")
      .eq("tester_code", testerCode)
      .eq("material_id", m.material_id);
    if (conceptError) console.error("Concept fetch error:", conceptError);
    const distinct = [...new Set((concepts ?? []).map((c) => c.concept_name))];
    materials.push({
      material_id: m.material_id,
      material_name: m.material_name,
      concepts: distinct,
    });
  }

  return { profile, sessions, materials };
}

/** Permanently deletes all data for a tester in the correct FK-safe order. */
export async function deleteTesterData(testerCode: string): Promise<void> {
  // 1. Get all session IDs for this tester
  const { data: sessionRows, error: sessionError } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("tester_code", testerCode);
  if (sessionError) {
    console.error("Delete error (sessions lookup):", sessionError);
    throw new Error("Could not delete your data. Please try again.");
  }
  const sessionIds = (sessionRows ?? []).map((r) => r.session_id);

  // 2. Delete messages for those sessions
  if (sessionIds.length > 0) {
    const { error: msgError } = await supabase
      .from("messages")
      .delete()
      .in("session_id", sessionIds);
    if (msgError) {
      console.error("Delete error (messages):", msgError);
      throw new Error("Could not delete your data. Please try again.");
    }
  }

  // 3. Delete concept_coverage
  const { error: ccError } = await supabase
    .from("concept_coverage")
    .delete()
    .eq("tester_code", testerCode);
  if (ccError) {
    console.error("Delete error (concept_coverage):", ccError);
    throw new Error("Could not delete your data. Please try again.");
  }

  // 4. Delete mastery_events
  const { error: meError } = await supabase
    .from("mastery_events")
    .delete()
    .eq("tester_code", testerCode);
  if (meError) {
    console.error("Delete error (mastery_events):", meError);
    throw new Error("Could not delete your data. Please try again.");
  }

  // 5. Delete misconception_events
  const { error: misError } = await supabase
    .from("misconception_events")
    .delete()
    .eq("tester_code", testerCode);
  if (misError) {
    console.error("Delete error (misconception_events):", misError);
    throw new Error("Could not delete your data. Please try again.");
  }

  // 6. Delete sessions
  const { error: sDeleteError } = await supabase
    .from("sessions")
    .delete()
    .eq("tester_code", testerCode);
  if (sDeleteError) {
    console.error("Delete error (sessions):", sDeleteError);
    throw new Error("Could not delete your data. Please try again.");
  }

  // 7. Delete materials
  const { error: matError } = await supabase
    .from("materials")
    .delete()
    .eq("tester_code", testerCode);
  if (matError) {
    console.error("Delete error (materials):", matError);
    throw new Error("Could not delete your data. Please try again.");
  }

  // 8. Delete tester_profiles
  const { error: tpError } = await supabase
    .from("tester_profiles")
    .delete()
    .eq("tester_code", testerCode);
  if (tpError) {
    console.error("Delete error (tester_profiles):", tpError);
    throw new Error("Could not delete your data. Please try again.");
  }
}
