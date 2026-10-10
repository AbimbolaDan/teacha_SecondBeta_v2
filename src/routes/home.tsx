import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home as HomeIcon, Library as LibraryIcon, User } from "lucide-react";
import { z } from "zod";
import { checkStoredTesterCode } from "@/lib/auth.functions";
import { getTesterProfile, getRecentSessions, type RecentSession } from "@/lib/home.functions";

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
  still_confused: { label: "Still confused", className: "bg-amber-100 text-amber-800" },
  getting_there: { label: "Getting there", className: "bg-teal-100 text-teal-800" },
  i_get_it: { label: "I get it", className: "bg-green-100 text-green-800" },
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

function Home() {
  const navigate = useNavigate();
  const { encouragement } = Route.useSearch();
  const [name, setName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEncouragement, setShowEncouragement] = useState(encouragement === "1" || encouragement === "thanks");

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
        const check = await checkStoredTesterCode({ data: { testerCode: stored } });
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

  const lastSession = sessions[0] ?? null;
  const recentThree = sessions.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-lg px-4 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
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
          className="mt-6 w-full rounded-xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start New Session
        </button>

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
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {lastSession.session_mode}
                  </span>
                )}
                <ConfidenceBadge rating={lastSession.confidence_rating} />
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
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
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {s.session_mode}
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

      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link to="/home" className="flex flex-col items-center gap-1 px-4 py-1 text-primary">
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/library" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <LibraryIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Library</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
