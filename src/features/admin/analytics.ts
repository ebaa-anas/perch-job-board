import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";

export interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface AdminAnalytics {
  range: number;
  signups: Point[];
  jobs: Point[];
  applications: Point[];
  totals: {
    users: number;
    seekers: number;
    recruiters: number;
    admins: number;
    companies: number;
    suspendedCompanies: number;
    jobs: number;
    publishedJobs: number;
    applications: number;
    openReports: number;
  };
  topCompanies: { id: string; name: string; slug: string; jobs: number; applicants: number }[];
}

function emptySeries(days: number): Map<string, number> {
  const map = new Map<string, number>();
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  return map;
}

function bucket(rows: { created_at: string }[], days: number): Point[] {
  const series = emptySeries(days);
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (series.has(key)) series.set(key, (series.get(key) ?? 0) + 1);
  }
  return Array.from(series, ([date, value]) => ({ date, value }));
}

/** Everything the /admin overview needs, one service-role round of queries. */
export const getAdminAnalytics = cache(
  async (days = 30): Promise<AdminAnalytics> => {
    await requireRole("admin");
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceIso = since.toISOString();

    const [
      profilesRes,
      companiesRes,
      jobsRes,
      appsRes,
      recentProfiles,
      recentJobs,
      recentApps,
      openReportsRes,
      jobsByCompany,
      appsJoin,
    ] = await Promise.all([
      admin.from("profiles").select("role"),
      admin.from("companies").select("id, name, slug, suspended_at"),
      admin.from("jobs").select("status"),
      admin.from("applications").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("created_at").gte("created_at", sinceIso),
      admin.from("jobs").select("created_at").gte("created_at", sinceIso),
      admin.from("applications").select("created_at").gte("created_at", sinceIso),
      admin
        .from("company_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin.from("jobs").select("company_id"),
      admin.from("applications").select("jobs!inner ( company_id )"),
    ]);

    const profiles = profilesRes.data ?? [];
    const companies = companiesRes.data ?? [];
    const jobs = jobsRes.data ?? [];

    const jobCountByCompany = new Map<string, number>();
    for (const row of jobsByCompany.data ?? []) {
      const id = (row as { company_id: string }).company_id;
      jobCountByCompany.set(id, (jobCountByCompany.get(id) ?? 0) + 1);
    }
    const applicantCountByCompany = new Map<string, number>();
    for (const row of appsJoin.data ?? []) {
      const id = (row as { jobs: { company_id: string } }).jobs.company_id;
      applicantCountByCompany.set(id, (applicantCountByCompany.get(id) ?? 0) + 1);
    }

    const topCompanies = companies
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        jobs: jobCountByCompany.get(c.id) ?? 0,
        applicants: applicantCountByCompany.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.applicants - a.applicants || b.jobs - a.jobs)
      .slice(0, 6);

    return {
      range: days,
      signups: bucket(recentProfiles.data ?? [], days),
      jobs: bucket(recentJobs.data ?? [], days),
      applications: bucket(recentApps.data ?? [], days),
      totals: {
        users: profiles.length,
        seekers: profiles.filter((p) => p.role === "seeker").length,
        recruiters: profiles.filter((p) => p.role === "recruiter").length,
        admins: profiles.filter((p) => p.role === "admin").length,
        companies: companies.length,
        suspendedCompanies: companies.filter((c) => c.suspended_at).length,
        jobs: jobs.length,
        publishedJobs: jobs.filter((j) => j.status === "published").length,
        applications: appsRes.count ?? 0,
        openReports: openReportsRes.count ?? 0,
      },
      topCompanies,
    };
  },
);
