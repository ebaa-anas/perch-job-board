import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";

export interface MyApplication {
  id: string;
  note: string | null;
  createdAt: string;
  job: {
    id: string;
    slug: string;
    title: string;
    status: "published" | "draft" | "closed";
    company: { name: string; slug: string };
  };
}

export interface JobApplicant {
  id: string;
  note: string | null;
  createdAt: string;
  cvFilename: string | null;
  hasCv: boolean;
  seeker: {
    id: string;
    fullName: string | null;
    headline: string | null;
    location: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
  };
}

/** { jobId -> applicant count } across all of the recruiter's jobs. RLS scopes
 *  `applications` SELECT to jobs the caller owns, so this needs no id list. */
export const getApplicantCountsForOwner = cache(
  async (): Promise<Record<string, number>> => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("applications").select("job_id");
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = (row as { job_id: string }).job_id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  },
);

/** Has the signed-in seeker already applied to this job? */
export const hasApplied = cache(async (jobId: string): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("seeker_id", user.id);
  return (count ?? 0) > 0;
});

/** The signed-in seeker's applications, newest first, with job + company. */
export const getMyApplications = cache(async (): Promise<MyApplication[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, note, created_at, jobs!inner ( id, slug, title, status, companies!inner ( name, slug ) )",
    )
    .eq("seeker_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getMyApplications: ${error.message}`);

  type Row = {
    id: string;
    note: string | null;
    created_at: string;
    jobs: {
      id: string;
      slug: string;
      title: string;
      status: MyApplication["job"]["status"];
      companies: { name: string; slug: string };
    };
  };

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    note: row.note,
    createdAt: row.created_at,
    job: {
      id: row.jobs.id,
      slug: row.jobs.slug,
      title: row.jobs.title,
      status: row.jobs.status,
      company: {
        name: row.jobs.companies.name,
        slug: row.jobs.companies.slug,
      },
    },
  }));
});

/**
 * Applicants for a job the signed-in recruiter owns. RLS returns rows only when
 * `owns_job(job_id)` (or admin), so an unauthorised caller just gets [].
 */
export const getJobApplicants = cache(
  async (jobId: string): Promise<JobApplicant[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, note, created_at, cv_path, cv_filename, seeker_id, " +
          "profiles ( full_name, seeker_profiles ( headline, location, portfolio_url, linkedin_url, github_url ) )",
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`getJobApplicants: ${error.message}`);

    type Row = {
      id: string;
      note: string | null;
      created_at: string;
      cv_path: string | null;
      cv_filename: string | null;
      seeker_id: string;
      profiles: {
        full_name: string | null;
        seeker_profiles: {
          headline: string | null;
          location: string | null;
          portfolio_url: string | null;
          linkedin_url: string | null;
          github_url: string | null;
        } | null;
      } | null;
    };

    return (data as unknown as Row[]).map((row) => {
      const sp = row.profiles?.seeker_profiles ?? null;
      return {
        id: row.id,
        note: row.note,
        createdAt: row.created_at,
        cvFilename: row.cv_filename,
        hasCv: Boolean(row.cv_path),
        seeker: {
          id: row.seeker_id,
          fullName: row.profiles?.full_name ?? null,
          headline: sp?.headline ?? null,
          location: sp?.location ?? null,
          portfolioUrl: sp?.portfolio_url ?? null,
          linkedinUrl: sp?.linkedin_url ?? null,
          githubUrl: sp?.github_url ?? null,
        },
      };
    });
  },
);
