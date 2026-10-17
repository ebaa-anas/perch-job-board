import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/features/jobs/utils";
import { STAGE_LABELS } from "@/features/applications/pipeline";
import type { JobFunnel } from "@/features/analytics/funnel";
import type { JobFunnelRow } from "@/features/analytics/data";

/**
 * The recruiter funnel.
 *
 * Every figure is rendered as "—" when it is null rather than as 0: a job
 * nobody has seen has no conversion rate, and showing 0% would read as a
 * failure rather than as missing data.
 */

function rate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function hours(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "under an hour";
  if (value < 48) return `${value} h`;
  return `${Math.round(value / 24)} days`;
}

export function FunnelSummary({ overall }: { overall: JobFunnel }) {
  const tiles: { label: string; value: string; hint: string }[] = [
    {
      label: "Job views",
      value: overall.views.toLocaleString("en-US"),
      hint: "Excludes your own team's visits",
    },
    {
      label: "Applications",
      value: overall.applications.toLocaleString("en-US"),
      hint: `${rate(overall.applyRate)} of views`,
    },
    {
      label: "Replied to",
      value: rate(overall.responseRate),
      hint: `${overall.awaiting} still waiting`,
    },
    {
      label: "Typical reply time",
      value: hours(overall.medianHoursToFirstResponse),
      hint: "Median, first response",
    },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tile.label}
          </dt>
          <dd className="font-display mt-1 text-3xl">{tile.value}</dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FunnelTable({ rows }: { rows: JobFunnelRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Post a job and its numbers will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">
          Views, applications and response rate for each of your jobs
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-semibold">Job</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Applied</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Apply rate</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Replied</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Reply time</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Waiting</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.jobId}>
              <th scope="row" className="px-4 py-3 text-left font-normal">
                <Link
                  href={`/dashboard/jobs/${row.jobId}/applicants`}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {row.status !== "published" && (
                    <Badge tone="outline">
                      {row.status === "closed" ? "Closed" : "Draft"}
                    </Badge>
                  )}
                  posted {formatRelativeDate(row.postedAt)}
                </span>
              </th>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.funnel.views.toLocaleString("en-US")}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.funnel.applications}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {rate(row.funnel.applyRate)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {rate(row.funnel.responseRate)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {hours(row.funnel.medianHoursToFirstResponse)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.funnel.awaiting > 0 ? (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {row.funnel.awaiting}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where candidates currently sit, across every job the team owns. */
export function StageBreakdown({ overall }: { overall: JobFunnel }) {
  const entries = Object.entries(overall.stageCounts).filter(
    ([, count]) => count > 0,
  );
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map(([stage, count]) => (
        <li
          key={stage}
          className="rounded-full border border-border px-3 py-1 text-sm"
        >
          <span className="text-muted-foreground">
            {STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
          </span>{" "}
          <span className="font-medium tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}
