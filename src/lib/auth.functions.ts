import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const inputSchema = z.object({
  testerCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  course: z.string().trim().min(1),
  yearLevel: z.string().trim().min(1),
  institution: z.string().trim().min(1),
});

/** Verifies a tester code and saves profile details. Queries Supabase directly from the client. */
export async function validateTesterCode(input: {
  testerCode: string;
  name: string;
  course: string;
  yearLevel: string;
  institution: string;
}): Promise<{ ok: boolean; profile: Record<string, unknown> | null }> {
  const data = inputSchema.parse(input);

  const { data: profile, error } = await supabase
    .from("tester_profiles")
    .select("*")
    .eq("tester_code", data.testerCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Auth check error:", error);
    return { ok: false, profile: null };
  }
  if (!profile) {
    return { ok: false, profile: null };
  }

  const { error: updateError } = await supabase
    .from("tester_profiles")
    .update({
      name: data.name,
      course: data.course,
      year_level: data.yearLevel,
      institution: data.institution,
    })
    .eq("tester_code", data.testerCode);

  if (updateError) {
    console.error("Auth check error:", updateError);
    throw new Error("Could not save your details. Please try again.");
  }

  return { ok: true, profile };
}

/** Checks whether a stored tester code is still valid and active. Queries Supabase directly from the client. */
export async function checkStoredTesterCode(input: {
  testerCode: string;
}): Promise<{ valid: boolean; profile: Record<string, unknown> | null }> {
  const { testerCode } = z.object({ testerCode: z.string().trim().min(1) }).parse(input);

  const { data: profile, error } = await supabase
    .from("tester_profiles")
    .select("*")
    .eq("tester_code", testerCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Auth check error:", error);
    return { valid: false, profile: null };
  }

  return { valid: !!profile, profile: profile ?? null };
}
