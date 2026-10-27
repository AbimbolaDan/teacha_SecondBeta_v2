import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { WUNMI_SYSTEM_PROMPT } from "./wunmi-prompt";

export const GEMINI_MODEL = "gemini-3.8-flash"
export const HISTORY_WINDOW = 15;

export type TesterProfile = {
  name: string | null;
  course: string | null;
  year_level: string | null;
};
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type PastSession = {
  materialName: string;
  confidenceRating: string | null;
  concepts: string[];
};

/** Builds the full context sent to Gemini for each message. */
export function buildSessionContext(args: {
  profile: TesterProfile;
  materialName: string;
  materialContent: string;
  sessionMode: "learning" | "study";
  pastSessions: PastSession[];
  history: ChatMessage[];
}): { systemInstruction: string; contents: Content[] } {
  const systemInstruction = WUNMI_SYSTEM_PROMPT;

  const past = args.pastSessions.length
    ? args.pastSessions
        .map(
          (s, i) =>
            `${i + 1}. Material: ${s.materialName} | Confidence: ${s.confidenceRating ?? "not rated"} | Concepts covered: ${s.concepts.length ? s.concepts.join(", ") : "none recorded"}`,
        )
        .join("\n")
    : "No previous completed sessions.";

  const modeNote =
    args.sessionMode === "study"
      ? "Session mode: STUDY MODE. The student is studying independently and will ask for help when needed."
      : "Session mode: LEARNING MODE. Teach the student through this material.";

  const hasMaterial = args.materialContent.trim().length > 0;
  const materialBlock = hasMaterial
    ? `Uploaded material: ${args.materialName}\n---BEGIN MATERIAL---\n${args.materialContent}\n---END MATERIAL---`
    : "No uploaded material for this session. The student is asking a general academic question or requesting tutoring on a topic. Use your own knowledge to teach.";

  const preamble = [
    `Student profile:\nName: ${args.profile.name ?? "Unknown"}\nCourse: ${args.profile.course ?? "Unknown"}\nYear level: ${args.profile.year_level ?? "Unknown"}`,
    `Last three completed sessions:\n${past}`,
    modeNote,
    materialBlock,
  ].join("\n\n");

  const windowed = args.history.slice(-HISTORY_WINDOW);
  const contents: Content[] = [
    { role: "user", parts: [{ text: preamble }] },
    { role: "model", parts: [{ text: "Understood. I have the student's profile, history, and material." }] },
    ...windowed.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  ];
  return { systemInstruction, contents };
}

export async function callGemini(ctx: { systemInstruction: string; contents: Content[] }) {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: ctx.systemInstruction,
  });
  const result = await model.generateContent({ contents: ctx.contents });
  return result.response.text();
}
