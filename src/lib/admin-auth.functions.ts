import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loginSchema = z.object({ password: z.string().min(1) });

export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("verify_admin_password", {
      input_password: data.password,
    });
    if (error || !result) {
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export const setAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_admin_password", {
      input_password: data.password,
    });
    if (error) throw new Error("Could not set admin password.");
    return { ok: true as const };
  });
