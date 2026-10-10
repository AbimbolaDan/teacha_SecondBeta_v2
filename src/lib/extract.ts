// Browser-only text extraction. Libraries are loaded dynamically.
export async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages.join("\n\n");
}

export async function extractDocx(file: File): Promise<string> {
  // @ts-expect-error browser build has no types
  const mammoth = (await import("mammoth/mammoth.browser")) as { extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export type PendingMaterial = {
  materialId: string | null;
  materialName: string;
  contentText: string;
  uploadType: string;
  wordCount: number;
};

export const PENDING_KEY = "teacha_pending_material";
