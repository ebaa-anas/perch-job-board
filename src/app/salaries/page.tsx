import type { Metadata } from "next";
import Link from "next/link";

import { getJobs } from "@/features/jobs/data";
import { formatSalary } from "@/features/jobs/utils";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
} from "@/features/jobs/types";
import {
  MIN_BENCHMARK_SAMPLE,
  computeBenchmark,
  type Benchmark,
  type SalaryRow,
} from "@/features/salary/benchmark";

export const metadata: Metadata = {
  title: "Salary ranges",
  description:
    "What roles on Perch actually pay, by experience level — median and quartiles from published listings that disclosed a salary.",
};

/**
 * The public salary explorer.
 *
 * Indexable on purpose: pay transparency is the single most searched-for thing
 * in job hunting and almost no board publishes it, so this is both the
 * product's clearest differentiator and its strongest organic-search surface.
 *
 * Everything shown is derived from published listings that disclosed a range,
 * and only where at least `MIN_BENCHMARK_SAMPLE` of them exist — so no
 * individual employer's pay is recoverable from this page.
 */
export default async function SalariesPage() {
  const jobs = await getJobs();

  const rows: SalaryRow[] = jobs.map((job) => ({
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    experience: job.experience,
    location: job.location,
  }));

  // One table per currency actually present, since mixing them would be
  // meaningless and converting them would be a guess about the rate.
  const currencies = [...new Set(rows.filter((r) => r.salaryMax > 0).map((r) => r.currency))].sort();

  const tables = currencies
    .map((currency) => ({
      currency,
      levels: EXPERIENCE_LEVELS.map((experience) => ({
        experience,
        benchmark: computeBenchmark(rows, { currency, experience }),
      })).filter(
        (entry): entry is { experience: ExperienceLevel; benchmark: Benchmark } =>
          entry.benchmark !== null,
      ),
    }))
    .filter((table) => table.levels.length > 0);

  const disclosed = rows.filter((r) => r.salaryMax > 0).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl">What these roles pay</h1>
        <p className="mt-2 text-muted-foreground">
          Median and quartile pay from the {disclosed} published{" "}
          {disclosed === 1 ? "listing" : "listings"} on Perch that disclosed a
          salary. Figures are midpoints of advertised ranges, not reported
          earnings.
        </p>
      </header>

      {tables.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Not enough published salaries yet. A range appears here once at least{" "}
          {MIN_BENCHMARK_SAMPLE} listings at the same level disclose one, so
          that no single employer&apos;s pay can be identified.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {tables.map((table) => (
            <section key={table.currency}>
              <h2 className="font-display text-2xl">{table.currency}</h2>
              <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Pay by experience level, in {table.currency}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-semibold">Level</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Lower quartile</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Median</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Upper quartile</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Listings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {table.levels.map(({ experience, benchmark }) => (
                      <tr key={experience}>
                        <th scope="row" className="px-4 py-3 text-left font-medium">
                          {EXPERIENCE_LABELS[experience]}
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatSalary(benchmark.p25, benchmark.p25, benchmark.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatSalary(benchmark.p50, benchmark.p50, benchmark.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatSalary(benchmark.p75, benchmark.p75, benchmark.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {benchmark.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        Looking for a role?{" "}
        <Link href="/jobs" className="text-primary hover:underline">
          Browse the board
        </Link>
        . Every listing shows how its pay compares with the figures above.
      </p>
    </div>
  );
}
