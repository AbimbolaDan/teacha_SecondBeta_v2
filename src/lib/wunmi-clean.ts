export type CleanedWunmiResponse = {
  content: string;
  feedback_tag: string | null;
  verify_flag: string | null;
  predict_concept: string | null;
  misconception_concepts: string[];
  page_reference: number | null;
};

/** Strips Wunmi's hidden markers from a raw Gemini reply, in the required order. */
export function cleanWunmiResponse(raw: string): CleanedWunmiResponse {
  let text = raw;
  let feedback_tag: string | null = null;
  let verify_flag: string | null = null;
  let predict_concept: string | null = null;
  const misconception_concepts: string[] = [];
  let page_reference: number | null = null;

  // 1. FEEDBACK
  text = text.replace(/\[?\s*FEEDBACK:\s*(correct|partial|needs_work)\s*\]?/gi, (_m, v: string) => {
    feedback_tag ??= v.toLowerCase();
    return "";
  });
  // 2. VERIFY
  text = text.replace(/\[?\s*VERIFY:\s*(high|moderate|uncertain)\s*\]?/gi, (_m, v: string) => {
    verify_flag ??= v.toLowerCase();
    return "";
  });
  // 3. PREDICT (concept name runs to end of line or closing bracket)
  text = text.replace(/\[?\s*PREDICT:\s*([^\]\n]+?)\s*(?:\]|$)/gim, (_m, v: string) => {
    predict_concept ??= v.trim();
    return "";
  });
  // 4. MISCONCEPTION
  text = text.replace(/\[?\s*MISCONCEPTION:\s*([^\]\n]+?)\s*(?:\]|$)/gim, (_m, v: string) => {
    const c = v.trim();
    if (c) misconception_concepts.push(c);
    return "";
  });
  // 5. PAGE
  text = text.replace(/\[?\s*PAGE:\s*(\d+)\s*\]?/gi, (_m, v: string) => {
    page_reference ??= Number(v);
    return "";
  });

  const content = text
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { content, feedback_tag, verify_flag, predict_concept, misconception_concepts, page_reference };
}
