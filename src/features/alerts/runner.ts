import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getJobs } from "@/features/jobs/data";
import { sendJobAlertEmail } from "@/lib/email";
import { createNotifications } from "@/features/notifications/notify";
import {
  ALERT_FREQUENCIES,
  isAlertDue,
  jobsMatchingSince,
  type AlertFrequency,
} from "@/features/alerts/schedule";
import type { Job } from "@/features/jobs/types";

/**
 * The job-alert runner, invoked by cron (see `/api/alerts/run`).
 *
 * Shape of the work: load every saved search once, load the published board
 * once, then match in memory. The board is small enough that one fetch beats
 * a query per search, and matching in memory is what lets alerts reuse the
 * browse page's own filter semantics instead of a parallel SQL implementation
 * that could silently disagree with it.
 *
 * Digests are grouped per seeker, not per search: someone with five alerts
 * wants one email, and five is how you train a person to filter you to spam.
 */

export interface AlertRunSummary {
  /** Saved searches that were due this run. */
  due: number;
  /** Seekers who received a digest. */
  notified: number;
  /** Total job matches across all digests. */
  matches: number;
  errors: number;
}

interface DueSearch {
  id: string;
  seekerId: string;
  label: string;
  query: string;
  lastRunAt: string | null;
}

interface DigestSection {
  label: string;
  query: string;
  jobs: Job[];
}

export async function runDueAlerts(now: Date = new Date()): Promise<AlertRunSummary> {
  const admin = createAdminClient();
  const summary: AlertRunSummary = { due: 0, notified: 0, matches: 0, errors: 0 };

  const { data, error } = await admin
    .from("saved_searches")
    .select("id, seeker_id, label, query, frequency, last_run_at");

  if (error) {
    console.error("[alerts] could not load saved searches", error);
    return { ...summary, errors: 1 };
  }

  const due: DueSearch[] = [];
  for (const row of data ?? []) {
    const frequency = (ALERT_FREQUENCIES as readonly string[]).includes(row.frequency)
      ? (row.frequency as AlertFrequency)
      : "daily";
    if (!isAlertDue(frequency, row.last_run_at, now)) continue;
    due.push({
      id: row.id,
      seekerId: row.seeker_id,
      label: row.label,
      query: row.query,
      lastRunAt: row.last_run_at,
    });
  }

  summary.due = due.length;
  if (due.length === 0) return summary;

  const jobs = await getJobs();

  const bySeeker = new Map<string, DigestSection[]>();
  for (const search of due) {
    const matched = jobsMatchingSince(jobs, search.query, search.lastRunAt);
    if (matched.length === 0) continue;
    summary.matches += matched.length;
    const sections = bySeeker.get(search.seekerId) ?? [];
    // Cap per alert so one very broad search cannot produce a 300-row email.
    sections.push({ label: search.label, query: search.query, jobs: matched.slice(0, 10) });
    bySeeker.set(search.seekerId, sections);
  }

  for (const [seekerId, sections] of bySeeker) {
    try {
      await deliverDigest(seekerId, sections);
      summary.notified += 1;
    } catch (deliveryError) {
      summary.errors += 1;
      console.error("[alerts] delivery failed", seekerId, deliveryError);
    }
  }

  // Stamp every due search, matched or not. Nothing was missed: a job that did
  // not match this run will not match a later one either, and leaving the
  // timestamp unset would re-scan the same window forever.
  const stampedAt = now.toISOString();
  const { error: stampError } = await admin
    .from("saved_searches")
    .update({ last_run_at: stampedAt })
    .in(
      "id",
      due.map((search) => search.id),
    );
  if (stampError) {
    summary.errors += 1;
    console.error("[alerts] could not stamp last_run_at", stampError);
  }

  return summary;
}

async function deliverDigest(
  seekerId: string,
  sections: DigestSection[],
): Promise<void> {
  await createNotifications(
    sections.map((section) => ({
      profileId: seekerId,
      kind: "job_alert" as const,
      title: `${section.jobs.length} new ${
        section.jobs.length === 1 ? "match" : "matches"
      } for “${section.label}”`,
      body: section.jobs
        .slice(0, 3)
        .map((job) => `${job.title} · ${job.company.name}`)
        .join("\n"),
      url: `/jobs?${section.query}`,
    })),
  );

  const { data } = await createAdminClient().auth.admin.getUserById(seekerId);
  const to = data.user?.email;
  if (!to) return;

  await sendJobAlertEmail({ to, sections });
}
