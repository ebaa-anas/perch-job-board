"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/features/auth/components/auth-ui";
import { applyToJob } from "@/features/applications/actions";

type State = "guest" | "seeker" | "applied" | "owner" | "other";

export function ApplyCta({
  jobId,
  jobSlug,
  applyUrl,
  state,
  hasCv,
}: {
  jobId: string;
  jobSlug: string;
  applyUrl: string | null;
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

  // External application — always wins, no account needed.
  if (applyUrl) {
    return (
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ size: "lg", className: "sm:w-auto" })}
      >
        Apply on company site
        <ArrowUpRight className="size-4" />
      </a>
    );
  }

  if (applied) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-accent px-4 py-2 text-sm font-medium text-primary">
        <Check className="size-4" />
        Applied — <Link href="/dashboard" className="underline">track it</Link>
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

  if (state === "other") return null;

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
          onClose={() => setOpen(false)}
          onApplied={() => {
            setApplied(true);
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ApplyDialog({
  jobId,
  hasCv,
  onClose,
  onApplied,
}: {
  jobId: string;
  hasCv: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [attachCv, setAttachCv] = React.useState(hasCv);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNeedsProfile(false);
    const result = await applyToJob({ jobId, note, attachCv });
    setBusy(false);
    if (result.ok) {
      onApplied();
      return;
    }
    setError(result.error);
    setNeedsProfile(Boolean(result.needsProfile));
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
