import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, BookOpen, Loader2 } from "lucide-react";
import { PENDING_KEY, type PendingMaterial } from "@/lib/extract";
import { startSession } from "@/lib/sessions.functions";

export const Route = createFileRoute("/mode")({
  head: () => ({
    meta: [
      { title: "Teacha — Choose a study mode" },
      { name: "description", content: "Pick how you want Teacha to help you study this material." },
      { property: "og:title", content: "Teacha — Choose a study mode" },
      { property: "og:description", content: "Pick how you want Teacha to help you study this material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModePage,
});

const CURRENT_SESSION_KEY = "teacha_current_session";
const SESSION_MATERIAL_KEY = "teacha_session_material";

function ModePage() {
  const navigate = useNavigate();
  const [material, setMaterial] = useState<PendingMaterial | null>(null);
  const [busy, setBusy] = useState<"learning" | "study" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) navigate({ to: "/upload" });
    else setMaterial(JSON.parse(raw));
  }, [navigate]);

  async function chooseMode(sessionMode: "learning" | "study") {
    if (!material || busy) return;
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) {
      navigate({ to: "/" });
      return;
    }
    setBusy(sessionMode);
    setError(null);
    try {
      const res = await startSession({
        data: { testerCode, materialId: material.materialId, sessionMode },
      });
      localStorage.setItem(CURRENT_SESSION_KEY, res.sessionId);
      sessionStorage.setItem(SESSION_MATERIAL_KEY, JSON.stringify(material));
      sessionStorage.removeItem(PENDING_KEY);
      navigate({ to: "/session" });
    } catch {
      setError("Could not start this session. Please try again.");
      setBusy(null);
    }
  }

  if (!material) return null;

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/upload" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">How do you want to study?</h1>
        <p className="mt-2 text-muted-foreground">
          {material.materialName} · {material.wordCount.toLocaleString()} words
        </p>

        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
            <GraduationCap className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">Learning Mode</h2>
            <p className="mt-2 flex-1 text-muted-foreground">
              Wunmi teaches you through your material, step by step.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => chooseMode("learning")}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === "learning" ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Teach me this"}
            </button>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
            <BookOpen className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-bold text-foreground">Study Mode</h2>
            <p className="mt-2 flex-1 text-muted-foreground">
              You study independently. Wunmi helps whenever you ask.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => chooseMode("study")}
              className="mt-6 w-full rounded-xl border border-primary px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
            >
              {busy === "study" ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "I am already studying"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
