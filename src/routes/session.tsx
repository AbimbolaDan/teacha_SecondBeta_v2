import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, MessageCircle, SendHorizonal, Sparkles } from "lucide-react";
import { type PendingMaterial } from "@/lib/extract";
import { getSessionChat, endSession } from "@/lib/sessions.functions";
import { sendWunmiMessage } from "@/lib/wunmi.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/session")({
  head: () => ({
    meta: [
      { title: "Teacha — Session" },
      { name: "description", content: "Your active Teacha study session with Wunmi." },
      { property: "og:title", content: "Teacha — Session" },
      { property: "og:description", content: "Your active Teacha study session with Wunmi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionPage,
});

const SESSION_MATERIAL_KEY = "teacha_session_material";
const CURRENT_SESSION_KEY = "teacha_current_session";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function SessionPage() {
  const navigate = useNavigate();
  const [material, setMaterial] = useState<PendingMaterial | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"learning" | "study">("learning");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"material" | "wunmi">("material");
  const [askButton, setAskButton] = useState<{ x: number; y: number; text: string } | null>(null);
  const materialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const testerCode = localStorage.getItem("teacha_tester_code");
    const sid = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!testerCode || !sid) {
      navigate({ to: "/" });
      return;
    }
    const raw = sessionStorage.getItem(SESSION_MATERIAL_KEY);
    const fallback = raw ? (JSON.parse(raw) as PendingMaterial) : undefined;
    setSessionId(sid);

    getSessionChat({ testerCode, sessionId: sid, fallbackMaterial: fallback })
      .then((res) => {
        setMaterial(res.session.material);
        setSessionMode(res.session.sessionMode);
        setMessages(res.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
        setLoaded(true);
      })
      .catch((e: Error) => setError(e.message));
  }, [navigate]);

  async function send() {
    const testerCode = localStorage.getItem("teacha_tester_code");
    const text = draft.trim();
    if (!text || !material || !testerCode || sending) return;
    setError(null);
    setSending(true);
    setDraft("");
    const studentMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };
    const history = [...messages, studentMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, studentMsg]);
    try {
      const res = await sendWunmiMessage({
        data: {
          testerCode,
          sessionId,
          sessionMode,
          materialName: material.materialName,
          materialContent: material.contentText,
          history,
        },
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-a-${Date.now()}`, role: "assistant", content: res.reply },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wunmi could not respond right now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function end() {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode || !sessionId || !material || ending) return;
    setEnding(true);
    setError(null);
    try {
      // One final message to Wunmi: close the session with a summary and an open question.
      const closingText =
        "Close this session. Summarise in two sentences what we covered today. State the main thing this student demonstrated understanding of. Then leave one specific open question for the student to think about before we meet again — a question that makes them want to return.";
      const history = [...messages, { role: "user" as const, content: closingText }].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendWunmiMessage({
        data: {
          testerCode,
          sessionId,
          sessionMode,
          materialName: material.materialName,
          materialContent: material.contentText,
          history,
        },
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-a-${Date.now()}`, role: "assistant", content: res.reply },
      ]);

      await endSession({ testerCode, sessionId });
      localStorage.removeItem(CURRENT_SESSION_KEY);
      sessionStorage.removeItem(SESSION_MATERIAL_KEY);
      navigate({ to: "/confidence", search: { sessionId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end this session. Please try again.");
      setEnding(false);
    }
  }

  // Text selection inside the material panel → floating "Ask Wunmi about this" button.
  const handleMaterialMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !materialRef.current) {
      setAskButton(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || !materialRef.current.contains(sel.anchorNode)) {
      setAskButton(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = materialRef.current.getBoundingClientRect();
    setAskButton({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      text: text.length > 500 ? `${text.slice(0, 500)}…` : text,
    });
  }, []);

  function askAboutSelection() {
    if (!askButton) return;
    setDraft(`I need help understanding this: ${askButton.text}`);
    setAskButton(null);
    window.getSelection()?.removeAllRanges();
    setActiveTab("wunmi");
  }

  if (error && !loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      </main>
    );
  }
  if (!material) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const isStudy = sessionMode === "study";

  const header = (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">{material.materialName}</h1>
        <span className="mt-0.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {isStudy ? "Study Mode" : "Learning Mode"}
        </span>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            End Session
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to end this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Wunmi will wrap up with a short summary and a question to think about.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue studying</AlertDialogCancel>
            <AlertDialogAction onClick={end} disabled={ending}>
              {ending ? "Wrapping up…" : "Yes, end session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );

  const materialPanel = (
    <div
      ref={materialRef}
      onMouseUp={handleMaterialMouseUp}
      onTouchEnd={handleMaterialMouseUp}
      className="relative flex-1 overflow-y-auto px-5 py-5"
    >
      <article className="mx-auto max-w-2xl text-[15px] leading-7 text-foreground sm:text-base sm:leading-8">
        <p className="whitespace-pre-wrap">{material.contentText}</p>
      </article>
      {askButton && (
        <button
          type="button"
          onClick={askAboutSelection}
          style={{ left: askButton.x, top: askButton.y }}
          className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full bg-[#C8973A] px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Wunmi about this
        </button>
      )}
    </div>
  );

  const chatPanel = <ChatPanel messages={messages} sending={sending} error={error} sessionMode={sessionMode} draft={draft} setDraft={setDraft} onSend={send} />;

  return (
    <main className="flex h-dvh flex-col bg-background">
      {header}

      {isStudy ? (
        <>
          {/* Mobile tabs */}
          <div className="flex border-b border-border bg-card md:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("material")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === "material"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Your Material
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wunmi")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === "wunmi"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              Wunmi
            </button>
          </div>

          {/* Mobile: tabbed panels */}
          <div className="flex min-h-0 flex-1 flex-col md:hidden">
            {activeTab === "material" ? materialPanel : chatPanel}
          </div>

          {/* Desktop: side-by-side 55/45 */}
          <div className="hidden min-h-0 flex-1 md:flex">
            <div className="flex w-[55%] flex-col border-r border-border">{materialPanel}</div>
            <div className="flex w-[45%] flex-col">{chatPanel}</div>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{chatPanel}</div>
      )}
    </main>
  );
}

function ChatPanel({
  messages,
  sending,
  error,
  sessionMode,
  draft,
  setDraft,
  onSend,
}: {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  sessionMode: "learning" | "study";
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => Promise<void>;
}) {
  const lastAssistantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the top of the newest Wunmi reply.
    lastAssistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [messages.length]);

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {sessionMode === "learning"
                ? "Wunmi is ready to teach you. Say hello to begin."
                : "You are studying independently. Ask Wunmi whenever you need help."}
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={m.id}
              ref={m.role === "assistant" && i === lastAssistantIndex ? lastAssistantRef : undefined}
              className={
                m.role === "user"
                  ? "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-student px-4 py-2.5 text-sm text-student-foreground"
                  : "max-w-[85%] self-start rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 text-sm text-card-foreground"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {sending && (
            <div className="flex max-w-[85%] items-center gap-1.5 self-start rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>

      {/* Composer — stays above the mobile keyboard via h-dvh flex layout */}
      <div className="border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder="Type your message…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !draft.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </>
  );
}
