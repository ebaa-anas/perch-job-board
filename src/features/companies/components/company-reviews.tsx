"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDate } from "@/features/jobs/utils";
import { FormError } from "@/features/auth/components/auth-ui";
import { Stars } from "@/features/companies/components/stars";
import {
  deleteOwnReview,
  upsertReview,
} from "@/features/companies/reviews-actions";
import type { CompanyReview, ReviewSummary } from "@/features/companies/reviews";

export function CompanyReviews({
  companyId,
  companyName,
  summary,
  reviews,
  canReview,
  isGuest,
  ownReview,
}: {
  companyId: string;
  companyName: string;
  summary: ReviewSummary;
  reviews: CompanyReview[];
  canReview: boolean;
  isGuest: boolean;
  ownReview: { rating: number; title: string; body: string } | null;
}) {
  const [formOpen, setFormOpen] = React.useState(false);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">
          Reviews{" "}
          <span className="text-muted-foreground">({summary.count})</span>
        </h2>
        {canReview && !formOpen && (
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            {ownReview ? "Edit your review" : "Write a review"}
          </Button>
        )}
        {isGuest && (
          <Link
            href={`/login?next=${encodeURIComponent(`/companies`)}`}
            className="text-sm text-primary hover:underline"
          >
            Sign in as a job seeker to review
          </Link>
        )}
      </div>

      {summary.avg != null && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Stars value={summary.avg} size={16} />
          <span className="font-medium">{summary.avg.toFixed(1)}</span>
          <span className="text-muted-foreground">
            from {summary.count} {summary.count === 1 ? "review" : "reviews"}
          </span>
        </div>
      )}

      {formOpen && (
        <ReviewForm
          companyId={companyId}
          companyName={companyName}
          initial={ownReview}
          onDone={() => setFormOpen(false)}
        />
      )}

      <ul className="mt-5 space-y-4">
        {reviews.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No reviews yet. Worked with {companyName}? Be the first.
          </li>
        )}
        {reviews.map((r) => (
          <li
            key={r.id}
            className={cn(
              "rounded-xl border border-border bg-card p-4",
              r.status === "hidden" && "opacity-60",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                {r.title && <span className="font-medium">{r.title}</span>}
              </div>
              <span className="text-xs text-muted-foreground">
                {r.isOwn ? "You" : r.reviewerName || "Job seeker"} ·{" "}
                {formatDate(r.createdAt)}
                {r.status === "hidden" && " · hidden by an admin"}
              </span>
            </div>
            {r.body && (
              <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
            )}
            {r.isOwn && <OwnReviewControls companyId={companyId} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function OwnReviewControls({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Delete your review?")) return;
        setBusy(true);
        await deleteOwnReview(companyId);
        setBusy(false);
        router.refresh();
      }}
      className="mt-2 text-xs text-red-600 underline hover:no-underline dark:text-red-400"
    >
      {busy ? "Deleting…" : "Delete my review"}
    </button>
  );
}

function ReviewForm({
  companyId,
  companyName,
  initial,
  onDone,
}: {
  companyId: string;
  companyName: string;
  initial: { rating: number; title: string; body: string } | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [rating, setRating] = React.useState(initial?.rating ?? 0);
  const [hover, setHover] = React.useState(0);
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (rating < 1) {
      setError("Pick a star rating.");
      return;
    }
    setBusy(true);
    const r = await upsertReview(companyId, { rating, title, body });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Failed.");
      return;
    }
    router.refresh();
    onDone();
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">
        Your experience with {companyName}
      </p>
      {error && <FormError message={error} />}

      <div
        className="flex gap-1"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-7 transition-colors",
                (hover || rating) >= n
                  ? "fill-highlight text-highlight"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>

      <Input
        placeholder="Headline (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        rows={4}
        placeholder="What was it like to interview with or work for this company?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Update review" : "Post review"}
        </Button>
      </div>
    </div>
  );
}
