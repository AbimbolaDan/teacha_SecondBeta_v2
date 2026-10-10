import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.object({ testerCode: z.string().trim().min(1) });

export const getTesterProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => codeSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("tester_profiles")
      .select("name, course, year_level, institution, is_active")
      .eq("tester_code", data.testerCode)
      .maybeSingle();
    if (error || !profile || !profile.is_active) return { found: false as const };
    return { found: true as const, profile };
  });

export type RecentSession = {
  session_id: string;
  session_mode: string | null;
  confidence_rating: string | null;
  started_at: string;
  ended_at: string | null;
  material_name: string | null;
};

export const getRecentSessions = createServerFn({ method: "POST" })
  .inputValidator((input) => codeSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sessions, error } = await supabaseAdmin
      .from("sessions")
      .select("session_id, session_mode, confidence_rating, started_at, ended_at, materials(material_name)")
      .eq("tester_code", data.testerCode)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(4);
    if (error) throw new Error("Could not load sessions");
    const mapped: RecentSession[] = (sessions ?? []).map((s) => ({
      session_id: s.session_id,
      session_mode: s.session_mode,
      confidence_rating: s.confidence_rating,
      started_at: s.started_at,
      ended_at: s.ended_at,
      material_name:
        s.materials && !Array.isArray(s.materials) ? (s.materials as { material_name: string }).material_name : null,
    }));
    return { sessions: mapped };
  });
