import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  testerCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  course: z.string().trim().min(1),
  yearLevel: z.string().trim().min(1),
  institution: z.string().trim().min(1),
});

export const validateTesterCode = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("tester_profiles")
      .select("tester_code, is_active")
      .eq("tester_code", data.testerCode)
      .maybeSingle();

    if (error || !profile || !profile.is_active) {
      return { ok: false as const };
    }

    const { error: updateError } = await supabaseAdmin
      .from("tester_profiles")
      .update({
        name: data.name,
        course: data.course,
        year_level: data.yearLevel,
        institution: data.institution,
      })
      .eq("tester_code", data.testerCode);

    if (updateError) {
      throw new Error("Could not save your details. Please try again.");
    }

    return { ok: true as const };
  });

export const checkStoredTesterCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ testerCode: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("tester_profiles")
      .select("tester_code, is_active")
      .eq("tester_code", data.testerCode)
      .maybeSingle();

    return { valid: !error && !!profile && profile.is_active };
  });
