import type { ExperienceLevel } from "@/features/jobs/types";

/**
 * Salary benchmarking from the board's own postings.
 *
 * The product already asks every recruiter for a salary range and stores it,
 * which means the board holds a corpus most job sites either do not have or
 * do not publish. Surfacing it is a straight transparency win for seekers —
 * "this role pays 15% under the median for mid-level in Istanbul" is the
 * single most useful sentence you can put on a listing — and it costs nothing
 * to compute.
 *
 * Pure, because every figure here is one a candidate may act on and a
 * quietly wrong median is worse than no median.
 */

/**
 * Minimum postings before a benchmark is published.
 *
 * This is a privacy threshold, not a statistical one. Below it, a median is
 * effectively one or two employers' pay made public and attributable — on a
 * board where the same page lists who is hiring. Ten keeps any individual
 * range from being recoverable.
 */
export const MIN_BENCHMARK_SAMPLE = 10;

/** Difference from the median treated as "at market" rather than reported. */
const AT_MARKET_BAND_PERCENT = 5;

export interface SalaryRow {
  salaryMin: number;
  salaryMax: number;
  currency: string;
  experience: ExperienceLevel;
  location: string;
}

export interface Benchmark {
  count: number;
  currency: string;
  experience: ExperienceLevel;
  /** The location the benchmark was narrowed to, or null for all locations. */
  location: string | null;
  p25: number;
  p50: number;
  p75: number;
}

/**
 * A posting's single data point.
 *
 * The midpoint of the advertised range, because that is the honest summary of
 * what the employer said. Using the maximum would flatter every listing, and
 * using the minimum would make the whole market look underpaid.
 */
export function midpoint(row: { salaryMin: number; salaryMax: number }): number {
  return Math.round((row.salaryMin + row.salaryMax) / 2);
}

/**
 * Linear-interpolated percentile over an ascending list, matching the
 * inclusive convention (the same one spreadsheets use), so the numbers agree
 * with whatever a recruiter checks them against.
 */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  const index = ((sorted.length - 1) * p) / 100;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(
    sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]),
  );
}

export interface BenchmarkQuery {
  currency: string;
  experience: ExperienceLevel;
  /** Optional; matched case-insensitively against the posting's location. */
  location?: string;
}

export function computeBenchmark(
  rows: SalaryRow[],
  query: BenchmarkQuery,
): Benchmark | null {
  const wantedLocation = query.location?.trim().toLowerCase();

  const matching = rows.filter((row) => {
    // A zero range means the recruiter declined to say, not that the job pays
    // nothing; including it would drag every median toward zero.
    if (row.salaryMax <= 0) return false;
    if (row.currency !== query.currency) return false;
    if (row.experience !== query.experience) return false;
    if (wantedLocation && row.location.trim().toLowerCase() !== wantedLocation) {
      return false;
    }
    return true;
  });

  if (matching.length < MIN_BENCHMARK_SAMPLE) return null;

  const points = matching.map(midpoint).sort((a, b) => a - b);

  return {
    count: matching.length,
    currency: query.currency,
    experience: query.experience,
    // Echo the corpus's own spelling rather than the query's, so the label
    // reads "Istanbul" even when the caller passed " istanbul ".
    location: wantedLocation ? matching[0].location.trim() : null,
    p25: percentile(points, 25)!,
    p50: percentile(points, 50)!,
    p75: percentile(points, 75)!,
  };
}

export interface BenchmarkComparison {
  /** Signed difference from the median, as a whole percentage. */
  deltaPercent: number;
  verdict: "below" | "at" | "above";
}

export function compareToBenchmark(
  value: number,
  benchmark: Benchmark,
): BenchmarkComparison {
  const deltaPercent = Math.round(
    ((value - benchmark.p50) / benchmark.p50) * 100,
  );
  const verdict =
    Math.abs(deltaPercent) <= AT_MARKET_BAND_PERCENT
      ? "at"
      : deltaPercent < 0
        ? "below"
        : "above";
  return { deltaPercent, verdict };
}
