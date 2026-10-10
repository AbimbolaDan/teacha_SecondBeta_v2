import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { validateTesterCode, checkStoredTesterCode } from "@/lib/auth.functions";

const COURSES = [
  "MBBS",
  "Nursing Science",
  "Pharmacy",
  "Medical Laboratory Science",
  "Physiotherapy",
  "Other Health Science",
];

const YEAR_LEVELS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Postgraduate"];

const ERROR_MESSAGE = "This code is not recognised. Please check the code sent to you on WhatsApp.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teacha — Sign in with your tester code" },
      { name: "description", content: "Enter your Teacha tester code to start your study sessions." },
      { property: "og:title", content: "Teacha — Sign in with your tester code" },
      { property: "og:description", content: "Enter your Teacha tester code to start your study sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [testerCode, setTesterCode] = useState("");
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("teacha_tester_code");
    if (!stored) {
      setChecking(false);
      return;
    }
    checkStoredTesterCode({ data: { testerCode: stored } })
      .then((result) => {
        if (result.valid) {
          navigate({ to: "/home" });
        } else {
          localStorage.removeItem("teacha_tester_code");
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await validateTesterCode({
        data: { testerCode, name, course, yearLevel, institution },
      });
      if (result.ok) {
        localStorage.setItem("teacha_tester_code", testerCode.trim());
        navigate({ to: "/home" });
      } else {
        setError(ERROR_MESSAGE);
      }
    } catch {
      setError(ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-5xl font-bold tracking-tight text-foreground">Teacha</h1>
        <p className="mt-3 text-center text-base text-muted-foreground">
          Welcome! Enter your tester code and details to begin.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="tester-code" className="mb-1.5 block text-sm font-medium text-foreground">
              Tester code
            </label>
            <input
              id="tester-code"
              type="text"
              required
              value={testerCode}
              onChange={(e) => setTesterCode(e.target.value)}
              placeholder="e.g. TCH-001"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="course" className="mb-1.5 block text-sm font-medium text-foreground">
              Course
            </label>
            <select
              id="course"
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select your course
              </option>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="year-level" className="mb-1.5 block text-sm font-medium text-foreground">
              Year level
            </label>
            <select
              id="year-level"
              required
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select your year level
              </option>
              {YEAR_LEVELS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="institution" className="mb-1.5 block text-sm font-medium text-foreground">
              Institution
            </label>
            <input
              id="institution"
              type="text"
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Your university or college"
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Start studying"}
          </button>
        </form>
      </div>
    </div>
  );
}
