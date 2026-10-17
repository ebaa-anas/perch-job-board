import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { formatSalary } from "@/features/jobs/utils";
import { EXPERIENCE_LABELS } from "@/features/jobs/types";
import {
  compareToBenchmark,
  midpoint,
  type Benchmark,
} from "@/features/salary/benchmark";

/**
 * How this job's pay compares with the rest of the board.
 *
 * Phrased as a comparison against a named cohort with its size stated, never
 * as a verdict on the employer. A seeker deciding whether to spend an evening
 * on an application deserves to know they are looking at the bottom quartile;
 * a recruiter deserves to see the same number before a good candidate quietly
 * declines.
 */
export function SalaryBenchmark({
  job,
  benchmark,
}: {
  job: { salaryMin: number; salaryMax: number; currency: string };
  benchmark: Benchmark;
}) {
  const value = midpoint(job);
  const { deltaPercent, verdict } = compareToBenchmark(value, benchmark);

  const cohort = [
    EXPERIENCE_LABELS[benchmark.experience].toLowerCase(),
    "roles",
    benchmark.location ? `in ${benchmark.location}` : "on Perch",
  ].join(" ");

  const { Icon, tone, headline } =
    verdict === "below"
      ? {
          Icon: TrendingDown,
          tone: "text-amber-700 dark:text-amber-400",
          headline: `${Math.abs(deltaPercent)}% below the median for ${cohort}`,
        }
      : verdict === "above"
        ? {
            Icon: TrendingUp,
            tone: "text-emerald-700 dark:text-emerald-400",
            headline: `${deltaPercent}% above the median for ${cohort}`,
          }
        : {
            Icon: Minus,
            tone: "text-muted-foreground",
            headline: `About the median for ${cohort}`,
          };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pay in context
      </h2>
      <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${tone}`}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {headline}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
        {(
          [
            ["Lower quartile", benchmark.p25],
            ["Median", benchmark.p50],
            ["Upper quartile", benchmark.p75],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="rounded-lg bg-muted/50 p-2">
            <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">
              {formatSalary(amount, amount, benchmark.currency)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Based on {benchmark.count} published {cohort} that disclosed a salary.
        Midpoints of advertised ranges, not reported earnings.
      </p>
    </section>
  );
}
