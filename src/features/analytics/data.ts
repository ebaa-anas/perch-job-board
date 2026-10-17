import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import {
  computeJobFunnel,
  type FunnelApplication,
  type JobFunnel,
} from "@/features/analytics/funnel";
import {
  DEFAULT_STAGE,
  isApplicationStage,
} from "@/features/applications/pipeline";

export interface JobFunnelRow {
  jobId: string;
  title: string;
  slug: string;
  status: "published" | "draft" | "closed";
  postedAt: string;
  funnel: JobFunnel;
}

export interface FunnelReport {
  rows: JobFunnelRow[];
  /**
   * Team-wide totals, computed from the same flat application list the rows
   * are built from — not by averaging the rows, which would weight a job with
   * two applicants the same as one with two hundred.
   */
  overall: JobFunnel;
}

/**
 * The recruiter's own jobs with a funnel attached to each, plus the totals.
 *
 * Three reads, not three-per-job: the jobs, every application's stage, and the
 * view totals. RLS scopes all three to the caller's team (`owns_job()`, which
 * is membership-based since migration 0018), so none of them needs an id list
 * and an unauthorised caller simply gets empty results.
 */
export const getOwnFunnelReport = cache(async (): Promise<FunnelReport> => {
  const supabase = await createClient();

  const [jobsResult, applicationsResult, viewsResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, slug, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("job_id, created_at, application_pipeline ( stage, decided_at )"),
    supabase.from("job_view_totals").select("job_id, views"),
  ]);

  if (jobsResult.error) {
    console.error("[getOwnFunnelReport] jobs", jobsResult.error);
    return { rows: [], overall: computeJobFunnel({ views: 0, applications: [] }) };
  }
  if (applicationsResult.error) {
    console.error("[getOwnFunnelReport] applications", applicationsResult.error);
  }
  if (viewsResult.error) {
    console.error("[getOwnFunnelReport] views", viewsResult.error);
  }

  type ApplicationRow = {
    job_id: string;
    created_at: string;
    application_pipeline: { stage: string; decided_at: string | null } | null;
  };

  const byJob = new Map<string, FunnelApplication[]>();
  const allApplications: FunnelApplication[] = [];

  for (const row of (applicationsResult.data as unknown as ApplicationRow[]) ?? []) {
    const application: FunnelApplication = {
      createdAt: row.created_at,
      stage: isApplicationStage(row.application_pipeline?.stage)
        ? row.application_pipeline.stage
        : DEFAULT_STAGE,
      decidedAt: row.application_pipeline?.decided_at ?? null,
    };
    allApplications.push(application);
    const list = byJob.get(row.job_id) ?? [];
    list.push(application);
    byJob.set(row.job_id, list);
  }

  const views = new Map<string, number>();
  let totalViews = 0;
  for (const row of viewsResult.data ?? []) {
    if (!row.job_id) continue;
    const count = Number(row.views ?? 0);
    views.set(row.job_id, count);
    totalViews += count;
  }

  const rows: JobFunnelRow[] = (jobsResult.data ?? []).map((job) => ({
    jobId: job.id,
    title: job.title,
    slug: job.slug,
    status: job.status as JobFunnelRow["status"],
    postedAt: job.created_at,
    funnel: computeJobFunnel({
      views: views.get(job.id) ?? 0,
      applications: byJob.get(job.id) ?? [],
    }),
  }));

  return {
    rows,
    overall: computeJobFunnel({ views: totalViews, applications: allApplications }),
  };
});
