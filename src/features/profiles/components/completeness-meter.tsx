"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import type { Completeness } from "@/features/profiles/completeness";

/**
 * Profile strength, with the next step named.
 *
 * A bare percentage is a scold. What makes a meter work is the sentence
 * underneath it — "add your experience level to appear in more searches" —
 * so the component leads with the single highest-value gap and says what the
 * seeker gets, not what they failed to do.
 */
export function CompletenessMeter({ completeness }: { completeness: Completeness }) {
  const { t } = useLocale();
  const { percent, next } = completeness;

  const tone =
    percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-primary" : "bg-amber-500";

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">{t.profile.completeness}</h2>
        <span className="text-sm font-medium tabular-nums">{percent}%</span>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.profile.completeness}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2.5 text-sm text-muted-foreground">
        {next ? t.profile.next[next.id] : t.profile.completeHint}
      </p>
    </section>
  );
}
