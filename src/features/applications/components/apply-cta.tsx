"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/features/auth/components/auth-ui";
import { applyToJob } from "@/features/applications/actions";
import type { JobApplicationQuestion } from "@/features/jobs/types";

type State = "guest" | "seeker" | "applied" | "owner" | "other";

export function ApplyCta({
  jobId,
  jobSlug,
  questions,
  state,
  hasCv,
}: {
  jobId: string;
  jobSlug: string;
  questions: JobApplicationQuestion[];
  state: State;
  hasCv: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applied, setApplied] = React.useState(state === "applied");
  const [open, setOpen] = React.useState(false);

  const wantsApply = searchParams.get("apply") === "1";
  const [autoHandled, setAutoHandled] = React.useState(false);
  if (wantsApply && !autoHandled && state === "seeker" && !applied && !open) {
    setAutoHandled(true);
    setOpen(true);
  }

  if (applied) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-accent px-4 py-2 text-sm font-medium text-primary">
        <Check className="size-4" />
        Applied —{" "}
        <Link href="/dashboard" className="underline">
          track it
        </Link>
      </span>
    );
  }

  if (state === "owner") {
    return (
      <Link
        href={`/dashboard/jobs/${jobId}/applicants`}
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        View applicants
      </Link>
    );
  }

  if (state === "other") {
    return (
      <p className="text-sm text-muted-foreground">
        Only job seekers can apply to jobs.
      </p>
    );
  }

  if (state === "guest") {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/jobs/${jobSlug}?apply=1`)}`}
        className={buttonVariants({ size: "lg", className: "sm:w-auto" })}
      >
        Sign in to apply
      </Link>
    );
  }

  // Signed-in seeker, not yet applied.
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        Apply now
      </Button>
      {open && (
        <ApplyDialog
          jobId={jobId}
          hasCv={hasCv}
          questions={questions}
          onClose={() => setOpen(false)}
          onApplied={() => {
            setOpen(false);
            setApplied(true);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

type AnswerValue = string | boolean;

function blankAnswers(questions: JobApplicationQuestion[]): Record<string, AnswerValue> {
  return Object.fromEntries(
    questions.map((q) => [q.id, q.type === "yes_no" ? false : ""]),
  );
}

function ApplyDialog({
  jobId,
  hasCv,
  questions,
  onClose,
  onApplied,
}: {
  jobId: string;
  hasCv: boolean;
  questions: JobApplicationQuestion[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [attachCv, setAttachCv] = React.useState(hasCv);
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>(() =>
    blankAnswers(questions),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNeedsProfile(false);
    setFieldErrors({});
    const result = await applyToJob({ jobId, note, attachCv, answers });
    setBusy(false);
    if (result.ok) {
      onApplied();
      return;
    }
    setError(result.error);
    setNeedsProfile(Boolean(result.needsProfile));
    setFieldErrors(result.fieldErrors ?? {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Apply to this job"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 className="font-display text-2xl">Apply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile and headline are shared with the recruiter.
        </p>

        <div className="mt-4 space-y-4">
          {error && <FormError message={error} />}
          {needsProfile && (
            <Link
              href="/profile"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Go to your profile
            </Link>
          )}

          <div className="space-y-1.5">
            <label htmlFor="apply-note" className="text-sm font-medium">
              Note to the recruiter{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="apply-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A sentence on why you're a fit…"
            />
          </div>

          {questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              error={fieldErrors[q.id]}
              onChange={(value) => setAnswer(q.id, value)}
            />
          ))}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attachCv}
              disabled={!hasCv}
              onChange={(e) => setAttachCv(e.target.checked)}
              className="size-4 rounded border-border"
            />
            {hasCv ? (
              "Attach my current CV"
            ) : (
              <span className="text-muted-foreground">
                No CV on file —{" "}
                <Link href="/profile" className="text-primary underline">
                  upload one
                </Link>
              </span>
            )}
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Sending…" : "Submit application"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: JobApplicationQuestion;
  value: AnswerValue | undefined;
  error?: string;
  onChange: (value: AnswerValue) => void;
}) {
  const label = (
    <label htmlFor={`q-${question.id}`} className="text-sm font-medium">
      {question.label}
      {!question.required && <span className="text-muted-foreground"> (optional)</span>}
    </label>
  );

  if (question.type === "yes_no") {
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === true}
              onChange={() => onChange(true)}
            />
            Yes
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === false}
              onChange={() => onChange(false)}
            />
            No
          </label>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="space-y-1.5">
        {label}
        <Select
          id={`q-${question.id}`}
          value={typeof value === "string" ? value : ""}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Choose one…
          </option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Textarea
        id={`q-${question.id}`}
        rows={question.type === "long_text" ? 4 : 2}
        value={typeof value === "string" ? value : ""}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
