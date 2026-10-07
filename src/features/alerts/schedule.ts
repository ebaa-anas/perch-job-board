import { filterAndSortJobs, parseJobFilters } from "@/features/jobs/utils";
import type { Job } from "@/features/jobs/types";

/**
 * When a saved search is due, and which jobs it should report.
 *
 * Pure, so the alert runner's decisions are testable without a database or a
 * cron. Matching deliberately reuses `parseJobFilters` + `filterAndSortJobs`,
 * the exact pair `/jobs` uses: an alert that disagreed with the page the seeker
 * saved it from would be worse than no alert.
 */

export const ALERT_FREQUENCIES = ["daily", "weekly"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

/**
 * Minimum hours between sends.
 *
 * Under the nominal period on purpose: a cron pinned to 06:00 drifts a few
 * minutes either way, and a strict 24h comparison would silently turn a daily
 * alert into an every-other-day one.
 */
const MIN_HOURS: Record<AlertFrequency, number> = {
  daily: 20,
  weekly: 24 * 6.5,
};

export function isAlertDue(
  frequency: AlertFrequency,
  lastRunAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  // An unparseable timestamp means we cannot prove it ran; send rather than
  // leave a seeker silently unsubscribed by bad data.
  if (!Number.isFinite(last)) return true;
  const elapsedHours = (now.getTime() - last) / 3_600_000;
  return elapsedHours >= MIN_HOURS[frequency];
}

/**
 * The jobs one saved search should report.
 *
 * `since` is exclusive: a job posted at exactly the last run time was already
 * in that run, and sending it again is the fastest way to teach a seeker to
 * ignore the emails.
 */
export function jobsMatchingSince(
  jobs: Job[],
  query: string,
  since: string | null,
): Job[] {
  const filters = parseJobFilters(
    Object.fromEntries(new URLSearchParams(query)) as Record<string, string>,
  );
  const matched = filterAndSortJobs(jobs, filters);
  if (!since) return matched;

  const cutoff = new Date(since).getTime();
  if (!Number.isFinite(cutoff)) return matched;
  return matched.filter((job) => new Date(job.postedAt).getTime() > cutoff);
}
