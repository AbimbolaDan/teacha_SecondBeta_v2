import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home as HomeIcon, Library as LibraryIcon, User, Trash2, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkStoredTesterCode } from "@/lib/auth.functions";
import {
  fetchProfileBoard,
  deleteTesterData,
  type ProfileData,
  type SessionHistoryItem,
  type MaterialWithConcepts,
} from "@/lib/profile.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Teacha — Profile" },
      { name: "description", content: "Your Teacha tester profile." },
      { property: "og:title", content: "Teacha — Profile" },
      { property: "og:description", content: "Your Teacha tester profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  still_confused: { label: "Still Confused", className: "bg-amber-100 text-amber-800" },
  getting_there: { label: "Getting There", className: "bg-teal-100 text-teal-800" },
  i_get_it: { label: "I Get It", className: "bg-green-100 text-green-800" },
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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "< 1 min";
  return `${minutes} min`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [materials, setMaterials] = useState<MaterialWithConcepts[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const data = await fetchProfileBoard(stored);
        setProfile(data.profile);
        setSessions(data.sessions);
        setMaterials(data.materials);
      } catch (e) {
        console.error("Profile load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function handleDelete() {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTesterData(testerCode);
      localStorage.removeItem("teacha_tester_code");
      localStorage.removeItem("teacha_current_session");
      localStorage.removeItem("teacha_session_material");
      sessionStorage.removeItem("teacha_pending_material");
      navigate({ to: "/" });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete your data. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto w-full max-w-lg px-4 pt-10">
        {/* Section 1: Profile */}
        {profile && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{profile.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.course}</p>
            <p className="text-sm text-muted-foreground">
              {profile.year_level}
              {profile.institution ? ` · ${profile.institution}` : ""}
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground/70">
              Tester code: {profile.tester_code}
            </p>
          </section>
        )}

        {/* Section 2: Session History */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Session History
          </h2>
          {sessions.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No sessions yet — your study history will appear here once you complete a session.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {sessions.map((s) => (
                <div key={s.session_id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold text-card-foreground">
                    {s.material_name ?? "Untitled Material"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {s.session_mode && (
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{
                          backgroundColor:
                            s.session_mode === "learning" ? "#0D9488" : "#C8973A",
                        }}
                      >
                        {s.session_mode === "learning" ? "Learning" : "Study"}
                      </span>
                    )}
                    <ConfidenceBadge rating={s.confidence_rating} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDuration(s.duration_seconds)}</span>
                    <span>·</span>
                    <span>{formatDateTime(s.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Coverage Map */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            What you have studied
          </h2>
          {materials.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No study materials yet — upload material and start a session to see your concept coverage here.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {materials.map((m) => (
                <div key={m.material_id}>
                  <p className="mb-1.5 text-sm font-medium text-foreground">{m.material_name}</p>
                  <div className="h-6 w-full overflow-hidden rounded-full bg-gray-200">
                    {m.concepts.length > 0 && (
                      <div className="flex h-full">
                        {m.concepts.map((_, i) => (
                          <div
                            key={i}
                            className="h-full flex-1"
                            style={{ backgroundColor: "#0D9488" }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delete link */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirm("");
              setDeleteError(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
          >
            <Trash2 className="h-4 w-4" />
            Delete My Data
          </button>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link to="/home" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/library" className="flex flex-col items-center gap-1 px-4 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <LibraryIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Library</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-1 px-4 py-1 text-primary">
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">Delete all your data?</h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              This will permanently delete all your sessions, messages, study materials, and profile.
              This action cannot be undone.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">
              Type <span className="font-bold text-destructive">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              disabled={deleting}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Type DELETE here"
            />
            {deleteError && (
              <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== "DELETE"}
                className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
