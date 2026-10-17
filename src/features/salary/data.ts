import { cache } from "react";

import { getJobs } from "@/features/jobs/data";
import {
  computeBenchmark,
  type Benchmark,
  type SalaryRow,
} from "@/features/salary/benchmark";
import type { Job } from "@/features/jobs/types";

/**
 * Benchmark lookups over the published board.
 *
 * Reuses `getJobs()` — the same request-scoped, RLS-filtered read the browse
 * page uses — rather than a bespoke query, so a benchmark can only ever be
 * built from postings that are actually public. Nothing here can surface a
 * draft or a closed role's pay.
 */

function toRow(job: Job): SalaryRow {
  return {
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    experience: job.experience,
    location: job.location,
  };
}

/**
 * The benchmark for one job's own slice of the market.
 *
 * Tries the job's exact location first and falls back to all locations,
 * because "mid-level in Istanbul" is the more useful comparison but a smaller
 * board will not have ten of those yet. The returned `location` says which
 * one the caller got, so the label never overstates the cohort.
 */
export const getBenchmarkForJob = cache(
  async (jobId: string): Promise<Benchmark | null> => {
    const jobs = await getJobs();
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job || job.salaryMax <= 0) return null;

    const rows = jobs.map(toRow);
    const query = { currency: job.currency, experience: job.experience };

    return (
      computeBenchmark(rows, { ...query, location: job.location }) ??
      computeBenchmark(rows, query)
    );
  },
);
