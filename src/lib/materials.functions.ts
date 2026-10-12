import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GEMINI_PROMPT =
  "Transcribe all text visible in this image exactly as written. If there are diagrams, describe them briefly in square brackets like this: a brief description of what the diagram shows. Return only the transcription and descriptions, nothing else.";

async function assertActive(testerCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tester_profiles")
    .select("is_active")
    .eq("tester_code", testerCode)
    .maybeSingle();
  if (!data?.is_active) throw new Error("Invalid tester code");
  return supabaseAdmin;
}

export const transcribeImage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(1).max(21_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await assertActive(data.testerCode);
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false as const, error: "Image reading is not configured." };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: GEMINI_PROMPT },
                { inline_data: { mime_type: data.mimeType, data: data.base64 } },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text());
      return { ok: false as const, error: "We couldn't read this image. Please try again." };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    return { ok: true as const, text };
  });

export const listMaterials = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ testerCode: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const db = await assertActive(data.testerCode);
    const { data: rows, error } = await db
      .from("materials")
      .select("material_id, material_name, content_text, upload_type, word_count, created_at")
      .eq("tester_code", data.testerCode)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load library");
    return { materials: rows ?? [] };
  });

export const saveMaterial = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        testerCode: z.string().min(1),
        materialName: z.string().trim().min(1).max(300),
        contentText: z.string(),
        uploadType: z.string().max(20),
        wordCount: z.number().int().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const db = await assertActive(data.testerCode);
    const { data: row, error } = await db
      .from("materials")
      .insert({
        tester_code: data.testerCode,
        material_name: data.materialName,
        content_text: data.contentText,
        upload_type: data.uploadType,
        word_count: data.wordCount,
      })
      .select("material_id")
      .single();
    if (error) throw new Error("Could not save material");
    return { materialId: row.material_id };
  });
