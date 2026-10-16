import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  User,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  FileText,
  FileImage,
  File as FileIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkStoredTesterCode } from "@/lib/auth.functions";
import { PENDING_KEY, type PendingMaterial } from "@/lib/extract";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Teacha — Library" },
      { name: "description", content: "Your Teacha study materials." },
      { property: "og:title", content: "Teacha — Library" },
      { property: "og:description", content: "Your Teacha study materials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

type MaterialRow = {
  material_id: string;
  material_name: string;
  upload_type: string | null;
  word_count: number | null;
  created_at: string;
  content_text: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function uploadIcon(type: string | null) {
  if (type === "image") return <FileImage className="h-4 w-4" />;
  if (type === "pdf") return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

function CoverageBar({ concepts }: { concepts: string[] }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
      {concepts.length > 0 && (
        <div className="flex h-full">
          {concepts.map((_, i) => (
            <div key={i} className="h-full flex-1 bg-primary" />
          ))}
        </div>
      )}
    </div>
  );
}

function Library() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [conceptsMap, setConceptsMap] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) {
      navigate({ to: "/" });
      return;
    }
    try {
      const check = await checkStoredTesterCode({ testerCode });
      if (!check.valid) {
        localStorage.removeItem("teacha_tester_code");
        navigate({ to: "/" });
        return;
      }

      const { data: rows, error: matError } = await supabase
        .from("materials")
        .select("material_id, material_name, upload_type, word_count, created_at, content_text")
        .eq("tester_code", testerCode)
        .order("created_at", { ascending: false });
      if (matError) {
        console.error("Library load error:", matError);
        setError("Could not load your library.");
        return;
      }

      setMaterials(rows ?? []);

      const conceptMap: Record<string, string[]> = {};
      for (const m of rows ?? []) {
        const { data: concepts, error: cError } = await supabase
          .from("concept_coverage")
          .select("concept_name")
          .eq("tester_code", testerCode)
          .eq("material_id", m.material_id);
        if (cError) console.error("Concept fetch error:", cError);
        conceptMap[m.material_id] = [...new Set((concepts ?? []).map((c) => c.concept_name))];
      }
      setConceptsMap(conceptMap);
    } catch (e) {
      console.error("Library load error:", e);
      setError("Could not load your library.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  function startWithMaterial(m: MaterialRow) {
    const pending: PendingMaterial = {
      materialId: m.material_id,
      materialName: m.material_name,
      contentText: m.content_text ?? "",
      uploadType: m.upload_type ?? "library",
      wordCount: m.word_count ?? 0,
    };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    navigate({ to: "/mode" });
  }

  async function saveRename(materialId: string) {
    const name = editName.trim();
    if (!name) return;
    setSavingRename(true);
    try {
      const { error: updateError } = await supabase
        .from("materials")
        .update({ material_name: name })
        .eq("material_id", materialId);
      if (updateError) {
        console.error("Rename error:", updateError);
        setError("Could not rename this material.");
      } else {
        setMaterials((prev) =>
          prev.map((m) => (m.material_id === materialId ? { ...m, material_name: name } : m)),
        );
        setEditingId(null);
      }
    } catch (e) {
      console.error("Rename error:", e);
      setError("Could not rename this material.");
    } finally {
      setSavingRename(false);
    }
  }

  async function confirmDelete(materialId: string) {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) return;
    setDeleting(true);
    setError(null);
    try {
      // 1. Find all sessions that used this material
      const { data: sessionRows, error: sError } = await supabase
        .from("sessions")
        .select("session_id")
        .eq("tester_code", testerCode)
        .eq("material_id", materialId);
      if (sError) throw new Error("Could not delete this material.");
      const sessionIds = (sessionRows ?? []).map((r) => r.session_id);

      // 2. Delete messages for those sessions
      if (sessionIds.length > 0) {
        const { error: msgError } = await supabase
          .from("messages")
          .delete()
          .in("session_id", sessionIds);
        if (msgError) throw new Error("Could not delete this material.");
      }

      // 3. Delete concept_coverage for this material
      const { error: ccError } = await supabase
        .from("concept_coverage")
        .delete()
        .eq("material_id", materialId);
      if (ccError) throw new Error("Could not delete this material.");

      // 4. Delete mastery_events for those sessions
      if (sessionIds.length > 0) {
        const { error: meError } = await supabase
          .from("mastery_events")
          .delete()
          .in("session_id", sessionIds);
        if (meError) throw new Error("Could not delete this material.");
      }

      // 5. Delete sessions for this material
      const { error: sDeleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("tester_code", testerCode)
        .eq("material_id", materialId);
      if (sDeleteError) throw new Error("Could not delete this material.");

      // 6. Delete the material itself
      const { error: matError } = await supabase
        .from("materials")
        .delete()
        .eq("material_id", materialId);
      if (matError) throw new Error("Could not delete this material.");

      setMaterials((prev) => prev.filter((m) => m.material_id !== materialId));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Delete material error:", e);
      setError(e instanceof Error ? e.message : "Could not delete this material.");
    } finally {
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">Library</h1>

        <button
          type="button"
          onClick={() => navigate({ to: "/upload" })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 font-heading"
        >
          <Plus className="h-5 w-5" />
          Add New Material
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
        )}

        {materials.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Your library is empty. Upload your first study material to get started — Teacha will help you master it!
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/upload" })}
              className="mt-4 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 font-heading"
            >
              Start a New Session
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {materials.map((m) => {
              const concepts = conceptsMap[m.material_id] ?? [];
              const isConfirmingDelete = confirmDeleteId === m.material_id;
              const isEditing = editingId === m.material_id;

              return (
                <div key={m.material_id} className="rounded-xl border border-border bg-card p-4">
                  {/* Top row: name + actions */}
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => startWithMaterial(m)}
                      className="min-w-0 flex-1 text-left"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => saveRename(m.material_id)}
                            disabled={savingRename}
                            className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                          >
                            {savingRename ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-card-foreground">{m.material_name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {m.upload_type && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                                {uploadIcon(m.upload_type)}
                                {m.upload_type}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {(m.word_count ?? 0).toLocaleString()} words
                            </span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                          </div>
                        </>
                      )}
                    </button>

                    {!isEditing && !isConfirmingDelete && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.material_id);
                            setEditName(m.material_name);
                          }}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.material_id)}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Coverage bar */}
                  {!isEditing && (
                    <div className="mt-3">
                      <CoverageBar concepts={concepts} />
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {isConfirmingDelete && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-destructive/10 px-3 py-2.5">
                      <p className="flex-1 text-sm text-destructive">Delete this material and all its sessions?</p>
                      <button
                        type="button"
                        onClick={() => confirmDelete(m.material_id)}
                        disabled={deleting}
                        className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 bg-ink">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link to="/home" className="flex min-h-[44px] flex-col items-center gap-1 px-4 py-1 text-paper/60 transition-colors hover:text-paper">
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/library" className="flex min-h-[44px] flex-col items-center gap-1 px-4 py-1 text-paper">
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
