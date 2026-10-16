import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Lock, Loader2, ChevronDown, ChevronRight, LogOut } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchAllSessions,
  fetchSessionTranscript,
  fetchApiUsage,
  fetchAllMaterials,
  type AdminSession,
  type AdminMessage,
  type AdminAssessment,
  type ApiUsageRow,
  type AdminMaterial,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Teacha — Admin" },
      { name: "description", content: "Admin dashboard for Teacha." },
    ],
  }),
  component: AdminPage,
});

const AUTH_KEY = "teacha_admin_authed";

type Tab = "sessions" | "usage" | "materials";

const CONFIDENCE_LABELS: Record<string, string> = {
  still_confused: "Still confused",
  getting_there: "Getting there",
  i_get_it: "I get it",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  still_confused: "bg-accent/20 text-accent-foreground",
  getting_there: "bg-primary/15 text-primary",
  i_get_it: "bg-primary/20 text-primary",
};

const FEEDBACK_COLORS: Record<string, string> = {
  correct: "bg-primary/20 text-primary",
  partial: "bg-accent/20 text-accent-foreground",
  needs_work: "bg-destructive/15 text-destructive",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 1) return "<1 min";
  return `${m} min`;
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored === "true") setAuthed(true);
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={() => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }} />;
}

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const adminKey = import.meta.env.VITE_ADMIN_KEY;
    if (!adminKey) {
      setError("Admin access is not configured.");
      setBusy(false);
      return;
    }
    if (password === adminKey) {
      sessionStorage.setItem(AUTH_KEY, "true");
      onAuth();
    } else {
      setError("Incorrect password.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center">
          <Lock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground font-heading">Admin Access</h1>
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter the admin password to continue.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("sessions");

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <h1 className="text-lg font-bold text-foreground font-heading">Teacha Admin</h1>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex gap-1 border-b border-border">
          {(["sessions", "usage", "materials"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "sessions" ? "Sessions" : t === "usage" ? "API Usage" : "Materials"}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "sessions" && <SessionsTab />}
          {tab === "usage" && <UsageTab />}
          {tab === "materials" && <MaterialsTab />}
        </div>
      </div>
    </main>
  );
}

// ─── Sessions Tab ───────────────────────────────────────────────────────────

type SessionFilters = {
  search: string;
  mode: string;
  confidence: string;
  group: string;
  minMessages: string;
};

function SessionsTab() {
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<SessionFilters>({
    search: "",
    mode: "all",
    confidence: "all",
    group: "all",
    minMessages: "",
  });

  useEffect(() => {
    fetchAllSessions()
      .then((data) => setSessions(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  const filtered = (sessions ?? []).filter((s) => {
    if (filters.search && !s.tester_code?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.mode !== "all" && s.session_mode !== filters.mode) return false;
    if (filters.confidence !== "all" && s.confidence_rating !== filters.confidence) return false;
    if (filters.group !== "all" && s.group_assignment !== filters.group) return false;
    if (filters.minMessages) {
      const min = parseInt(filters.minMessages, 10);
      if (!isNaN(min) && (s.message_count ?? 0) < min) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          placeholder="Search tester code…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Select value={filters.mode} onValueChange={(v) => setFilters({ ...filters, mode: v })}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
            <SelectItem value="study">Study</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.confidence} onValueChange={(v) => setFilters({ ...filters, confidence: v })}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Confidence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="still_confused">Still confused</SelectItem>
            <SelectItem value="getting_there">Getting there</SelectItem>
            <SelectItem value="i_get_it">I get it</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.group} onValueChange={(v) => setFilters({ ...filters, group: v })}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            <SelectItem value="A">Group A</SelectItem>
            <SelectItem value="B">Group B</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="number"
          min="0"
          placeholder="Min messages"
          value={filters.minMessages}
          onChange={(e) => setFilters({ ...filters, minMessages: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {!sessions && !error && (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {sessions && filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">No sessions match these filters.</p>
      )}

      {filtered.length > 0 && (
        <div className="mt-4 space-y-2">
          {filtered.map((s) => (
            <SessionRow
              key={s.session_id}
              session={s}
              expanded={expanded === s.session_id}
              onToggle={() => setExpanded(expanded === s.session_id ? null : s.session_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session: s,
  expanded,
  onToggle,
}: {
  session: AdminSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border bg-card overflow-hidden transition-shadow ${
        s.has_uncertain ? "border-l-4 border-l-destructive" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{s.tester_code ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{s.material_name ?? "No material"}</p>
          </div>
          <div>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white ${s.session_mode === "study" ? "bg-accent" : "bg-primary"}`}>
              {s.session_mode === "study" ? "Study" : s.session_mode === "learning" ? "Learning" : s.session_mode ?? "—"}
            </span>
          </div>
          <div className="text-sm text-foreground">
            <span className="font-medium">{s.message_count ?? 0}</span>
            <span className="text-muted-foreground"> msgs</span>
          </div>
          <div className="text-sm text-foreground">{fmtDuration(s.duration_seconds)}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(s.started_at)}</div>
          <div className="flex flex-wrap items-center gap-1">
            {s.confidence_rating && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[s.confidence_rating] ?? "bg-secondary text-secondary-foreground"}`}>
                {CONFIDENCE_LABELS[s.confidence_rating] ?? s.confidence_rating}
              </span>
            )}
            {s.has_predict && (
              <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                Predictive flag
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && <Transcript sessionId={s.session_id} groupAssignment={s.group_assignment} />}
    </div>
  );
}

function Transcript({ sessionId, groupAssignment }: { sessionId: string; groupAssignment: string | null }) {
  const [data, setData] = useState<{ messages: AdminMessage[]; assessments: AdminAssessment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionTranscript(sessionId)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [sessionId]);

  if (error) return <div className="px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data) return (
    <div className="flex justify-center px-4 py-4">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  const isGroupB = groupAssignment === "B";

  return (
    <div className="border-t border-border px-4 py-4">
      <div className="space-y-3">
        {data.messages.map((m) => (
          <MessageRow key={m.message_id} message={m} />
        ))}
      </div>

      {isGroupB && data.assessments.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-bold text-foreground">Post-Session Assessment</h3>
          <div className="mt-3 space-y-4">
            {data.assessments.map((a, i) => (
              <div key={a.mastery_event_id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground">Question {i + 1}</p>
                <p className="mt-1 text-sm text-foreground">{a.assessment_question ?? "—"}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Student Answer</p>
                <p className="mt-0.5 text-sm text-foreground">{a.student_answer ?? "—"}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Wunmi's Evaluation</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{a.wunmi_evaluation ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message: m }: { message: AdminMessage }) {
  const isWunmi = m.role === "assistant";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-foreground">{isWunmi ? "WUNMI" : "STUDENT"}</span>
        <span className="text-xs text-muted-foreground">{fmtDate(m.timestamp)}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{m.content}</p>
      {isWunmi && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.feedback_tag && (
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${FEEDBACK_COLORS[m.feedback_tag] ?? "bg-secondary text-secondary-foreground"}`}>
              {m.feedback_tag}
            </span>
          )}
          {m.verify_flag === "uncertain" && (
            <span className="inline-block rounded bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
              Verify: uncertain
            </span>
          )}
          {m.predict_concept && (
            <span className="inline-block rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Predicted difficulty: {m.predict_concept}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API Usage Tab ──────────────────────────────────────────────────────────

function UsageTab() {
  const [rows, setRows] = useState<ApiUsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiUsage()
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (!rows) return (
    <div className="mt-6 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = rows.find((r) => r.date === today);
  const todayCalls = todayRow?.api_calls ?? 0;

  return (
    <div>
      {todayCalls > 1400 && (
        <div className="mb-4 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground">
          Critical: today's API calls ({todayCalls.toLocaleString()}) exceed 1,400. Consider pausing sessions.
        </div>
      )}
      {todayCalls > 1200 && todayCalls <= 1400 && (
        <div className="mb-4 rounded-lg bg-accent/20 px-4 py-3 text-sm font-semibold text-accent-foreground">
          Warning: today's API calls ({todayCalls.toLocaleString()}) exceed 1,200. Monitor usage closely.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold text-foreground">Date</th>
              <th className="px-4 py-2.5 font-semibold text-foreground">API Calls</th>
              <th className="px-4 py-2.5 font-semibold text-foreground">Concept Extraction</th>
              <th className="px-4 py-2.5 font-semibold text-foreground">Assessment Generation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-border">
                <td className="px-4 py-2.5 text-foreground">{r.date}</td>
                <td className="px-4 py-2.5 text-foreground">
                  {(r.api_calls ?? 0).toLocaleString()}
                  {(r.api_calls ?? 0) > 1400 && <span className="ml-2 text-destructive">●</span>}
                  {(r.api_calls ?? 0) > 1200 && (r.api_calls ?? 0) <= 1400 && <span className="ml-2 text-accent">●</span>}
                </td>
                <td className="px-4 py-2.5 text-foreground">{(r.concept_extraction_calls ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-foreground">{(r.assessment_generation_calls ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">No API usage data recorded yet.</p>
      )}
    </div>
  );
}

// ─── Materials Tab ──────────────────────────────────────────────────────────

function MaterialsTab() {
  const [materials, setMaterials] = useState<AdminMaterial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllMaterials()
      .then(setMaterials)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (!materials) return (
    <div className="mt-6 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (materials.length === 0) {
    return <p className="mt-6 text-center text-sm text-muted-foreground">No materials have been uploaded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {materials.map((m) => (
        <div key={m.material_id} className="rounded-lg border border-border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tester</p>
              <p className="text-sm font-semibold text-foreground">{m.tester_code ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Material</p>
              <p className="text-sm font-semibold text-foreground">{m.material_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Type</p>
              <p className="text-sm text-foreground">{m.upload_type ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Word count</p>
              <p className="text-sm text-foreground">{(m.word_count ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Uploaded</p>
              <p className="text-sm text-foreground">{fmtDate(m.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sessions</p>
              <p className="text-sm text-foreground">{m.session_count}</p>
            </div>
          </div>
          {m.concepts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Concepts covered</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.concepts.map((c, i) => (
                  <span
                    key={i}
                    className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
