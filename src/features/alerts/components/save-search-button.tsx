"use client";

import * as React from "react";
import Link from "next/link";
import { BellPlus, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveSearch } from "@/features/alerts/actions";
import {
  ALERT_FREQUENCIES,
  ALERT_FREQUENCY_LABELS,
  type AlertFrequency,
} from "@/features/alerts/schedule";

/**
 * Turn the current `/jobs` filter set into a job alert.
 *
 * Placed on the browse page rather than in a settings screen because the
 * moment a seeker has just narrowed a search and found nothing is exactly the
 * moment an alert is worth something to them.
 */
export function SaveSearchButton({
  query,
  alreadySaved,
  suggestedLabel,
  signedInAsSeeker,
}: {
  /** The canonical `/jobs` search-params string for the current filters. */
  query: string;
  alreadySaved: boolean;
  suggestedLabel: string;
  signedInAsSeeker: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(suggestedLabel);
  const [frequency, setFrequency] = React.useState<AlertFrequency>("daily");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The suggested name follows the filters until the seeker types their own.
  // Adjusted during render rather than in an effect, the same way the site
  // header reacts to a path change.
  const [edited, setEdited] = React.useState(false);
  const [seenSuggestion, setSeenSuggestion] = React.useState(suggestedLabel);
  if (suggestedLabel !== seenSuggestion) {
    setSeenSuggestion(suggestedLabel);
    if (!edited) setLabel(suggestedLabel);
  }

  if (!signedInAsSeeker) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/jobs?${query}`)}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <BellPlus className="size-4" />
        Sign in to save this search
      </Link>
    );
  }

  if (alreadySaved || done) {
    return (
      <Link
        href="/alerts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
        Alert saved — manage alerts
      </Link>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BellPlus className="size-4" />
        Alert me about new matches
      </Button>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await saveSearch({ label, query, frequency });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setOpen(false);
  };

  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <label
          htmlFor="alert-label"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Alert name
        </label>
        <Input
          id="alert-label"
          value={label}
          maxLength={80}
          onChange={(e) => {
            setEdited(true);
            setLabel(e.target.value);
          }}
          disabled={busy}
        />
      </div>
      <div>
        <label
          htmlFor="alert-frequency"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          How often
        </label>
        <Select
          id="alert-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
          disabled={busy}
          className="w-auto"
        >
          {ALERT_FREQUENCIES.map((option) => (
            <option key={option} value={option}>
              {ALERT_FREQUENCY_LABELS[option]}
            </option>
          ))}
        </Select>
      </div>
      <Button onClick={submit} disabled={busy || !label.trim()}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Save alert
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </Button>
      {error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
