import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { generateAssessment, submitAssessmentAnswer } from "@/lib/assessment.functions";

export const Route = createFileRoute("/assessment")({
  validateSearch: z.object({ sessionId: z.string().uuid() }),
  head: () => ({
    meta: [
      { title: "Teacha — Assessment" },
      { name: "description", content: "Your post-session Teacha assessment." },
      { property: "og:title", content: "Teacha — Assessment" },
      { property: "og:description", content: "Your post-session Teacha assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssessmentPage,
});

type Stage =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "questions"; questions: string[] };

function AssessmentPage() {
  const navigate = useNavigate();
  const { sessionId } = Route.useSearch();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode) {
      navigate({ to: "/" });
      return;
    }
    generateAssessment({ data: { testerCode, sessionId } })
      .then(({ questions }) => setStage({ kind: "questions", questions }))
      .catch((e) =>
        setStage({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not prepare your assessment.",
        }),
      );
  }, [navigate, sessionId]);

  async function submit(questions: string[]) {
    const testerCode = localStorage.getItem("teacha_tester_code");
    if (!testerCode || submitting || !answer.trim()) return;
    setSubmitting(true);
    try {
      const { evaluation: ev } = await submitAssessmentAnswer({
        data: { testerCode, sessionId, question: questions[index], answer: answer.trim() },
      });
      setEvaluation(ev);
    } catch (e) {
      setEvaluation(e instanceof Error ? e.message : "Could not evaluate your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next(questions: string[]) {
    if (index + 1 >= questions.length) {
      navigate({ to: "/home", search: { encouragement: "thanks" } });
      return;
    }
    setIndex(index + 1);
    setAnswer("");
    setEvaluation(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-5 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-2xl font-bold text-foreground font-heading">Quick Assessment</h1>

        {stage.kind === "loading" && (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Wunmi is preparing your questions…</p>
          </div>
        )}

        {stage.kind === "error" && (
          <div className="mt-10 text-center">
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {stage.message}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/home", search: { encouragement: "thanks" } })}
              className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground font-heading"
            >
              Back to Home
            </button>
          </div>
        )}

        {stage.kind === "questions" && (
          <div className="mt-8">
            <p className="text-center text-sm text-muted-foreground">
              Question {index + 1} of {stage.questions.length}
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-base font-medium text-foreground">{stage.questions[index]}</p>
            </div>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={evaluation !== null || submitting}
              placeholder="Type your answer here…"
              rows={5}
              className="mt-4 w-full rounded-2xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />

            {evaluation && (
              <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Wunmi's feedback
                </p>
                <p className="mt-1 text-sm text-foreground">{evaluation}</p>
              </div>
            )}

            {evaluation === null ? (
              <button
                type="button"
                onClick={() => void submit(stage.questions)}
                disabled={submitting || !answer.trim()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity disabled:opacity-50 font-heading"
              >
                {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                Submit Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => next(stage.questions)}
                className="mt-4 w-full rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground font-heading"
              >
                {index + 1 >= stage.questions.length ? "Finish" : "Next Question"}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
