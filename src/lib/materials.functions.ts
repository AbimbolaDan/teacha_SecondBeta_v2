import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_PROMPT =
  "Transcribe all text visible in this image exactly as written. If there are diagrams, describe them briefly in square brackets like this: a brief description of what the diagram shows. Return only the transcription and descriptions, nothing else.";

const GEMINI_MODEL = "gemini-3.0-flash";

async function assertActive(testerCode: string) {
  const { data, error } = await supabase
    .from("tester_profiles")
    .select("is_active")
    .eq("tester_code", testerCode)
    .maybeSingle();
  if (error) console.error("Material save error: tester lookup failed:", error);
  if (!data?.is_active) throw new Error("Your tester code is no longer active.");
  return true;
}

const transcribeImageInput = z.object({
  testerCode: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(21_000_000),
});

export async function transcribeImage(
  raw: unknown,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const data = transcribeImageInput.parse(raw);
  try {
    await assertActive(data.testerCode);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Material save error: VITE_GEMINI_API_KEY not configured");
      return { ok: false, error: "Image reading is not configured." };
    }

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent([
      { text: GEMINI_PROMPT },
      { inlineData: { mimeType: data.mimeType, data: data.base64 } },
    ]);
    const text = result.response.text().trim();
    if (!text) {
      return { ok: false, error: "We couldn't read any text in this image. Please try again." };
    }
    return { ok: true, text };
  } catch (e) {
    console.error("Material save error: image transcription failed:", e);
    return { ok: false, error: "We couldn't read this image. Please try again." };
  }
}

const listMaterialsInput = z.object({ testerCode: z.string().min(1) });

export async function listMaterials(
  raw: unknown,
): Promise<{ materials: { material_id: string; material_name: string; content_text: string | null; upload_type: string | null; word_count: number | null; created_at: string }[] }> {
  const data = listMaterialsInput.parse(raw);
  try {
    await assertActive(data.testerCode);
    const { data: rows, error } = await supabase
      .from("materials")
      .select("material_id, material_name, content_text, upload_type, word_count, created_at")
      .eq("tester_code", data.testerCode)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Material save error: listMaterials query failed:", error);
      throw new Error("Could not load your library.");
    }
    return { materials: rows ?? [] };
  } catch (e) {
    console.error("Material save error: listMaterials failed:", e);
    throw e instanceof Error ? e : new Error("Could not load your library.");
  }
}

const saveMaterialInput = z.object({
  testerCode: z.string().min(1),
  materialName: z.string().trim().min(1).max(300),
  contentText: z.string(),
  uploadType: z.string().max(20),
  wordCount: z.number().int().nonnegative(),
});

export async function saveMaterial(
  raw: unknown,
): Promise<{ materialId: string }> {
  const data = saveMaterialInput.parse(raw);
  try {
    await assertActive(data.testerCode);
    const { data: row, error } = await supabase
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
    if (error) {
      console.error("Material save error: insert failed:", error);
      throw new Error("Could not save to your library. Please try again.");
    }
    if (!row) {
      console.error("Material save error: insert returned no row");
      throw new Error("Could not save to your library. Please try again.");
    }
    return { materialId: row.material_id };
  } catch (e) {
    console.error("Material save error:", e);
    throw e instanceof Error ? e : new Error("Could not save to your library. Please try again.");
  }
}
