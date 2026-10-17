"use client";

import * as React from "react";
import { Loader2, Lock, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/features/jobs/utils";
import {
  addApplicationNote,
  rateApplicant,
} from "@/features/applications/pipeline-actions";
import { STAGE_LABELS } from "@/features/applications/pipeline";
import type { ApplicationEvent } from "@/features/applications/data";

/**
 * Recruiter-side activity for one application: an internal rating, internal
 * notes, and the full event history.
 *
 * Everything here is recruiter-only. The `Lock` affordance on notes is load
 * bearing — a recruiter who is unsure whether the candidate can see a note
 * writes nothing useful.
 */
export function ApplicantActivity({
  applicationId,
  rating,
  events,
}: {
  applicationId: string;
  rating: number | null;
  events: ApplicationEvent[];
}) {
  return (
    <div className="space-y-5">
      <RatingControl applicationId={applicationId} rating={rating} />
      <NoteForm applicationId={applicationId} />
      <Timeline events={events} />
    </div>
  );
}

function RatingControl({
  applicationId,
  rating,
}: {
  applicationId: string;
  rating: number | null;
}) {
  const [value, setValue] = React.useState(rating);
  const [busy, setBusy] = React.useState(false);

  const set = async (next: number) => {
    // Clicking the current rating clears it, so there is a way back to "unrated".
    const target = next === value ? null : next;
    setValue(target);
    setBusy(true);
    await rateApplicant({ applicationId, rating: target });
    setBusy(false);
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your rating
      </h3>
      <div className="mt-1.5 flex items-center gap-1" aria-busy={busy}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = value !== null && star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => set(star)}
              disabled={busy}
              aria-label={`Rate ${star} of 5`}
              aria-pressed={filled}
              className="rounded p-0.5 transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              <Star
                className={
                  filled
                    ? "size-4 fill-amber-500 text-amber-500"
                    : "size-4 text-muted-foreground"
                }
              />
            </button>
          );
        })}
        {value !== null && (
          <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>
        )}
      </div>
    </div>
  );
}

function NoteForm({ applicationId }: { applicationId: string }) {
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await addApplicationNote({ applicationId, body });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
  };

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Internal note
      </h3>
      <div className="mt-1.5 space-y-1.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Only your team sees this."
          disabled={busy}
        />
        <Button size="sm" variant="outline" onClick={submit} disabled={busy || !body.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Add note
        </Button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        History
      </h3>
      <ol className="mt-2 space-y-3 border-l border-border pl-4">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-border"
            />
            <p className="text-xs text-muted-foreground">
              {formatDate(event.createdAt)}
              {event.visibility === "internal" && " · internal"}
            </p>
            <p className="text-sm">
              {event.kind === "stage_change"
                ? `Moved${event.fromStage ? ` from ${STAGE_LABELS[event.fromStage]}` : ""}${
                    event.toStage ? ` to ${STAGE_LABELS[event.toStage]}` : ""
                  }`
                : "Note"}
            </p>
            {event.body && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                {event.body}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
