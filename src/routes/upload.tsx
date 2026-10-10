import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Smartphone, Library as LibraryIcon, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { listMaterials, saveMaterial, transcribeImage } from "@/lib/materials.functions";
import {
  countWords,
  extractDocx,
  extractPdf,
  fileToBase64,
  PENDING_KEY,
  type PendingMaterial,
} from "@/lib/extract";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Teacha — Upload study material" },
      { name: "description", content: "Upload notes, PDFs or photos to start a Teacha study session." },
      { property: "og:title", content: "Teacha — Upload study material" },
      { property: "og:description", content: "Upload notes, PDFs or photos to start a Teacha study session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp";

type Material = Omit<PendingMaterial, "materialId"> & { materialId: string | null };
type Step = "choose" | "library" | "processing" | "confirm" | "name";
type LibRow = { material_id: string; material_name: string; content_text: string | null; upload_type: string | null; word_count: number | null };

function detectType(file: File): "pdf" | "docx" | "text" | "image" | null {
  const n = file.name.toLowerCase();
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (file.type === "text/plain" || n.endsWith(".txt")) return "text";
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/.test(n)) return "image";
  return null;
}

function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState<string | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [library, setLibrary] = useState<LibRow[] | null>(null);
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem("teacha_tester_code");
    if (!c) navigate({ to: "/" });
    else setCode(c);
  }, [navigate]);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("This file is too large. Please compress it at ilovepdf.com and try again.");
      return;
    }
    const type = detectType(file);
    if (!type) {
      setError("Please choose a PDF, DOCX, text file, or a JPG, PNG or WebP image.");
      return;
    }
    setStep("processing");
    try {
      let text = "";
      if (type === "pdf") text = await extractPdf(file);
      else if (type === "docx") text = await extractDocx(file);
      else if (type === "text") text = await file.text();
      else {
        const base64 = await fileToBase64(file);
        const mimeType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
        const res = await transcribeImage({ data: { testerCode: code!, mimeType, base64 } });
        if (!res.ok) throw new Error(res.error);
        text = res.text;
      }
      if (!text.trim()) throw new Error("We couldn't find any text in this file.");
      setMaterial({
        materialId: null,
        materialName: file.name.replace(/\.[^.]+$/, ""),
        contentText: text,
        uploadType: type,
        wordCount: countWords(text),
      });
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading this file.");
      setStep("choose");
    }
  }

  async function openLibrary() {
    setError(null);
    setStep("library");
    if (library || !code) return;
    try {
      const res = await listMaterials({ data: { testerCode: code } });
      setLibrary(res.materials);
    } catch {
      setError("Could not load your library.");
      setLibrary([]);
    }
  }

  function goToMode(m: Material) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(m));
    navigate({ to: "/mode" });
  }

  async function finish() {
    if (!material || !code) return;
    const name = material.materialName.trim();
    if (!name) return setError("Please give this material a name.");
    setBusy(true);
    setError(null);
    try {
      let materialId: string | null = null;
      if (save) {
        const res = await saveMaterial({
          data: { testerCode: code, materialName: name, contentText: material.contentText, uploadType: material.uploadType, wordCount: material.wordCount },
        });
        materialId = res.materialId;
      }
      goToMode({ ...material, materialName: name, materialId });
    } catch {
      setError("Could not save to your library. Please try again.");
      setBusy(false);
    }
  }

  function reset() {
    setMaterial(null);
    setSave(false);
    setError(null);
    setStep("choose");
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">What are you studying tonight?</h1>

        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        {step === "choose" && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary"
            >
              <Smartphone className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold text-foreground">Upload From Phone</span>
              <span className="text-sm text-muted-foreground">PDF, DOCX, text, or a photo of your notes (max 15MB)</span>
            </button>
            <button
              type="button"
              onClick={openLibrary}
              className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary"
            >
              <LibraryIcon className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold text-foreground">Upload From Library</span>
              <span className="text-sm text-muted-foreground">Pick something you've saved before</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {step === "processing" && (
          <div className="mt-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Reading your material…</p>
          </div>
        )}

        {step === "library" && (
          <div className="mt-6">
            <button type="button" onClick={reset} className="text-sm text-primary">← Choose another option</button>
            {!library ? (
              <Loader2 className="mt-6 h-6 w-6 animate-spin text-primary" />
            ) : library.length === 0 ? (
              <p className="mt-6 text-muted-foreground">Your library is empty. Upload something from your phone and save it to see it here.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {library.map((m) => (
                  <li key={m.material_id}>
                    <button
                      type="button"
                      onClick={() =>
                        goToMode({
                          materialId: m.material_id,
                          materialName: m.material_name,
                          contentText: m.content_text ?? "",
                          uploadType: m.upload_type ?? "library",
                          wordCount: m.word_count ?? 0,
                        })
                      }
                      className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary"
                    >
                      <p className="font-semibold text-foreground">{m.material_name}</p>
                      <p className="text-sm text-muted-foreground">{(m.word_count ?? 0).toLocaleString()} words</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "confirm" && material && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="mname">Material name</label>
            <input
              id="mname"
              value={material.materialName}
              onChange={(e) => setMaterial({ ...material, materialName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            />
            <p className="mt-4 text-foreground"><span className="font-semibold">{material.wordCount.toLocaleString()}</span> words</p>
            {material.wordCount > 8000 && (
              <p className="mt-3 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900">
                This section is quite long. Sessions work best with 10 to 20 pages at a time. You can continue or upload a smaller section.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setStep("name")} className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90">Continue</button>
              <button type="button" onClick={reset} className="flex-1 rounded-xl border border-border px-4 py-3 font-semibold text-foreground hover:bg-muted">Upload Something Else</button>
            </div>
          </div>
        )}

        {step === "name" && material && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="fname">Name this material</label>
            <input
              id="fname"
              value={material.materialName}
              onChange={(e) => setMaterial({ ...material, materialName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            />
            <label className="mt-5 flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">Save to my library</span>
              <Switch checked={save} onCheckedChange={setSave} />
            </label>
            <button type="button" disabled={busy} onClick={finish} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
