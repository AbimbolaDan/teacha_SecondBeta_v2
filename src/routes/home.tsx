import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home as HomeIcon, Library as LibraryIcon, User, SendHorizonal, Loader2, BookOpen } from "lucide-react";
import { z } from "zod";
import { checkStoredTesterCode } from "@/lib/auth.functions";
import { getTesterProfile, getRecentSessions, type RecentSession } from "@/lib/home.functions";
import { startSession } from "@/lib/sessions.functions";
import { listMaterials } from "@/lib/materials.functions";
import { type PendingMaterial } from "@/lib/extract";

export const Route = createFileRoute("/home")({
  validateSearch: z.object({ encouragement: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Teacha — Home" },
      { name: "description", content: "Your Teacha study home." },
      { property: "og:title", content: "Teacha — Home" },
      { property: "og:description", content: "Your Teacha study home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function nigeriaGreeting(): string {
  const hour = (new Date().getUTCHours() + 1) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  still_confused: { label: "Still confused", className: "bg-accent/20 text-accent-foreground" },
  getting_there: { label: "Getting there", className: "bg-primary/15 text-primary" },
  i_get_it: { label: "I get it", className: "bg-primary/20 text-primary" },
};

function ConfidenceBadge({ rating }: { rating: string | null }) {
  if (!rating) return null;
  const style = CONFIDENCE_STYLES[rating] ?? { label: rating, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const CURRENT_SESSION_KEY = "teacha_current_session";
const SESSION_MATERIAL_KEY = "teacha_session_material";
const PENDING_INITIAL_MESSAGE_KEY = "teacha_pending_initial_message";

type LibRow = { material_id: string; material_name: string; content_text: string | null; upload_type: string | null; word_count: number | null };

function Home() {
  const navigate = useNavigate();
  const { encouragement } = Route.useSearch();
  const [name, setName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEncouragement, setShowEncouragement] = useState(encouragement === "1" || encouragement === "thanks");
  const [askText, setAskText] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [showLibPicker, setShowLibPicker] = useState(false);
  const [library, setLibrary] = useState<LibRow[] | null>(null);
  const [libLoading, setLibLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LibRow | null>(null);

  useEffect(() => {
    if (!showEncouragement) return;
    const timer = setTimeout(() => setShowEncouragement(false), 6000);
    return () => clearTimeout(timer);
  }, [showEncouragement]);

  useEffect(() => {
    const stored = localStorage.getItem("teacha_tester_code");
    if (!stored) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      try {
        const check = await checkStoredTesterCode({ testerCode: stored });
        if (!check.valid) {
          localStorage.removeItem("teacha_tester_code");
          navigate({ to: "/" });
          return;
        }
        const [profileResult, sessionsResult] = await Promise.all([
          getTesterProfile({ data: { testerCode: stored } }),
          getRecentSessions({ data: { testerCode: stored } }),
        ]);
        if (profileResult.found) setName(profileResult.profile.name);
        setSessions(sessionsResult.sessions);
      } catch {
        // stay on page with what we have
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function openLibPicker() {
    if (library) {
      setShowLibPicker(true);
      return;
    }
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) return;
    setLibLoading(true);
    setShowLibPicker(true);
    try {
      const res = await listMaterials({ testerCode });
      setLibrary(res.materials);
    } catch {
      setLibrary([]);
    } finally {
      setLibLoading(false);
    }
  }

  async function submitAsk() {
    const testerCode = localStorage.getItem("teacha_tester_code");
    const text = askText.trim();
    if (!testerCode || !text || askBusy) return;
    setAskBusy(true);
    setAskError(null);
    try {
      let materialId: string | null = null;
      let fallbackMaterial: PendingMaterial | null = null;
      if (selectedMaterial) {
        materialId = selectedMaterial.material_id;
        fallbackMaterial = {
          materialId: selectedMaterial.material_id,
          materialName: selectedMaterial.material_name,
          contentText: selectedMaterial.content_text ?? "",
          uploadType: selectedMaterial.upload_type ?? "library",
          wordCount: selectedMaterial.word_count ?? 0,
        };
      }
      const res = await startSession({ testerCode, materialId, sessionMode: "learning" });
      localStorage.setItem(CURRENT_SESSION_KEY, res.sessionId);
      if (fallbackMaterial) {
        sessionStorage.setItem(SESSION_MATERIAL_KEY, JSON.stringify(fallbackMaterial));
      } else {
        sessionStorage.removeItem(SESSION_MATERIAL_KEY);
      }
      sessionStorage.setItem(PENDING_INITIAL_MESSAGE_KEY, text);
      navigate({ to: "/session" });
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Could not start your session. Please try again.");
      setAskBusy(false);
    }
  }

  const lastSession = sessions[0] ?? null;
  const recentThree = sessions.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-lg px-4 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">
          {nigeriaGreeting()}{name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ready to keep learning?</p>

        {showEncouragement && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
            {encouragement === "thanks"
              ? "Thank you for completing the assessment — your answers help us understand how you're learning."
              : "Great work today — every session brings you closer to mastering this. Keep it up!"}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/upload" })}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 font-heading"
        >
          Start New Session
        </button>

        {/* Natural-language entry point */}
        <section className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-card-foreground">Ask Wunmi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ask a question, request tutoring on a topic, or pick from your library.
            </p>
            {askError && (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{askError}</p>
            )}
            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitAsk();
                  }
                }}
                placeholder="What would you like to learn or study today?"
                rows={2}
                className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => void submitAsk()}
                disabled={askBusy || !askText.trim()}
                aria-label="Send to Wunmi"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {askBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={openLibPicker}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {selectedMaterial ? selectedMaterial.material_name : "Use a document from your Library"}
            </button>
            {showLibPicker && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
                {libLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !library || library.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    Your library is empty. Upload a document first or ask without one.
                  </p>
                ) : (
                  <ul className="py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMaterial(null);
                          setShowLibPicker(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${!selectedMaterial ? "font-semibold text-primary" : "text-foreground"}`}
                      >
                        No document (general question)
                      </button>
                    </li>
                    {library.map((m) => (
                      <li key={m.material_id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMaterial(m);
                            setShowLibPicker(false);
                          }}
                          className={`w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${selectedMaterial?.material_id === m.material_id ? "font-semibold text-primary" : "text-foreground"}`}
                        >
                          {m.material_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Continue Where You Left Off
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : lastSession ? (
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-card-foreground">
                {lastSession.material_name ?? "Untitled Material"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {lastSession.session_mode && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${lastSession.session_mode === "learning" ? "bg-primary" : "bg-accent"}`}>
                    {lastSession.session_mode === "learning" ? "Learning" : "Study"}
                  </span>
                )}
                <ConfidenceBadge rating={lastSession.confidence_rating} />
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-primary px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Continue
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No sessions yet — start your first one and your progress will show up here. You've got this!
            </p>
          )}
        </section>

        {recentThree.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Sessions
            </h2>
            <div className="mt-3 space-y-2">
              {recentThree.map((s) => (
                <div
                  key={s.session_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-card-foreground">
                      {s.material_name ?? "Untitled Material"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(s.ended_at ?? s.started_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.session_mode && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${s.session_mode === "learning" ? "bg-primary" : "bg-accent"}`}>
                        {s.session_mode === "learning" ? "Learning" : "Study"}
                      </span>
                    )}
                    <ConfidenceBadge rating={s.confidence_rating} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 bg-ink">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link to="/home" className="flex min-h-[44px] flex-col items-center gap-1 px-4 py-1 text-paper">
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/library" className="flex min-h-[44px] flex-col items-center gap-1 px-4 py-1 text-paper/60 transition-colors hover:text-paper">
            <LibraryIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Library</span>
          </Link>
          <Link to="/profile" className="flex min-h-[44px] flex-col items-center gap-1 px-4 py-1 text-paper/60 transition-colors hover:text-paper">
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
