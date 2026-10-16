import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { setConfidence } from "@/lib/sessions.functions";
import { processSessionEnd } from "@/lib/post-session.functions";

export const Route = createFileRoute("/confidence")({
  validateSearch: z.object({ sessionId: z.string().uuid() }),
  head: () => ({
    meta: [
      { title: "Teacha — How do you feel?" },
      { name: "description", content: "Rate how you feel about the material after your Teacha session." },
      { property: "og:title", content: "Teacha — How do you feel?" },
      { property: "og:description", content: "Rate how you feel about the material after your Teacha session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfidencePage,
});

const OPTIONS = [
  { value: "still_confused" as const, label: "Still Confused", bg: "bg-accent", hover: "hover:bg-accent/90" },
  { value: "getting_there" as const, label: "Getting There", bg: "bg-primary", hover: "hover:bg-primary/90" },
  { value: "i_get_it" as const, label: "I Get It", bg: "bg-primary", hover: "hover:bg-primary/90" },
];

function ConfidencePage() {
  const navigate = useNavigate();
  const { sessionId } = Route.useSearch();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(value: (typeof OPTIONS)[number]["value"]) {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode || saving) return;
    setSaving(value);
    setError(null);
    try {
      const { groupAssignment } = await setConfidence({
        testerCode, sessionId, confidenceRating: value,
      });
      // Background post-session processing; does not block navigation.
      void processSessionEnd({ data: { testerCode, sessionId } }).catch(() => {});
      if (groupAssignment === "B") {
        navigate({ to: "/assessment", search: { sessionId } });
      } else {
        navigate({ to: "/home", search: { encouragement: "1" } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your rating. Please try again.");
      setSaving(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-bold text-foreground font-heading">
          How do you feel about this material now?
        </h1>
        <div className="mt-8 flex flex-col gap-4">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void choose(opt.value)}
              disabled={saving !== null}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-5 text-lg font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${opt.bg} ${opt.hover}`}
            >
              {saving === opt.value && <Loader2 className="h-5 w-5 animate-spin" />}
              {opt.label}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
        )}
      </div>
    </main>
  );
}
