import {
  APPLICATION_STAGES,
  isDecided,
  type ApplicationStage,
} from "@/features/applications/pipeline";

/**
 * Per-job hiring funnel maths.
 *
 * Pure, because every number here is one a recruiter will make a decision on
 * and a silently wrong rate is worse than no rate. Two rules run throughout:
 * a ratio with nothing to divide by is `null` rather than `0` (an empty job
 * has no conversion rate, it has no data), and a nonsensical duration is
 * dropped rather than coerced.
 */

export interface FunnelApplication {
  createdAt: string;
  stage: ApplicationStage;
  /** When the employer first responded, or null while still unanswered. */
  decidedAt: string | null;
}

export interface JobFunnel {
  views: number;
  applications: number;
  /** Applications per 100 views, or null when no views are recorded. */
  applyRate: number | null;
  stageCounts: Record<ApplicationStage, number>;
  responded: number;
  awaiting: number;
  responseRate: number | null;
  medianHoursToFirstResponse: number | null;
}

/** A whole-number percentage, or null when the denominator is zero. */
export function percentage(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * Median of a list of hour values, to one decimal place.
 *
 * A median rather than a mean: one role left open over a holiday would drag an
 * average far enough to be useless, and the recruiter's question is "how long
 * does a typical applicant wait".
 */
export function medianHours(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

function emptyStageCounts(): Record<ApplicationStage, number> {
  return Object.fromEntries(
    APPLICATION_STAGES.map((stage) => [stage, 0]),
  ) as Record<ApplicationStage, number>;
}

function hoursBetween(from: string, to: string): number | null {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const hours = (end - start) / 3_600_000;
  // A response before the application means clock skew or an edited row.
  if (hours < 0) return null;
  return hours;
}

export function computeJobFunnel(input: {
  views: number;
  applications: FunnelApplication[];
}): JobFunnel {
  const stageCounts = emptyStageCounts();
  const responseTimes: number[] = [];
  let responded = 0;

  for (const application of input.applications) {
    if (stageCounts[application.stage] !== undefined) {
      stageCounts[application.stage] += 1;
    }
    if (isDecided(application.stage)) responded += 1;
    if (application.decidedAt) {
      const hours = hoursBetween(application.createdAt, application.decidedAt);
      if (hours !== null) responseTimes.push(hours);
    }
  }

  const applications = input.applications.length;

  return {
    views: input.views,
    applications,
    applyRate: percentage(applications, input.views),
    stageCounts,
    responded,
    awaiting: applications - responded,
    responseRate: percentage(responded, applications),
    medianHoursToFirstResponse: medianHours(responseTimes),
  };
}
