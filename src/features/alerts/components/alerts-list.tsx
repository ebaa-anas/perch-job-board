"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatRelativeDate } from "@/features/jobs/utils";
import {
  deleteSavedSearch,
  updateSavedSearch,
} from "@/features/alerts/actions";
import {
  ALERT_FREQUENCIES,
  ALERT_FREQUENCY_LABELS,
  type AlertFrequency,
} from "@/features/alerts/schedule";
import type { SavedSearch } from "@/features/alerts/data";

export function AlertsList({ searches }: { searches: SavedSearch[] }) {
  if (searches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Bell className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 font-display text-2xl">No alerts yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Filter the board to the roles you want, then save the search. We will
          email you when something new matches.
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Browse jobs
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {searches.map((search) => (
        <AlertRow key={search.id} search={search} />
      ))}
    </ul>
  );
}

function AlertRow({ search }: { search: SavedSearch }) {
  const router = useRouter();
  const [frequency, setFrequency] = React.useState<AlertFrequency>(search.frequency);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const changeFrequency = async (next: AlertFrequency) => {
    const previous = frequency;
    setFrequency(next);
    setBusy(true);
    setError(null);
    const result = await updateSavedSearch({ id: search.id, frequency: next });
    setBusy(false);
    if (!result.ok) {
      setFrequency(previous);
      setError(result.error);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteSavedSearch(search.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          href={`/jobs?${search.query}`}
          className="font-medium hover:underline"
        >
          {search.label}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {search.lastRunAt
            ? `Last checked ${formatRelativeDate(search.lastRunAt)}`
            : "Not checked yet"}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={frequency}
          onChange={(e) => changeFrequency(e.target.value as AlertFrequency)}
          disabled={busy}
          aria-label={`How often to check “${search.label}”`}
          className="h-9 w-auto"
        >
          {ALERT_FREQUENCIES.map((option) => (
            <option key={option} value={option}>
              {ALERT_FREQUENCY_LABELS[option]}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          disabled={busy}
          aria-label={`Delete alert “${search.label}”`}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>
    </li>
  );
}
