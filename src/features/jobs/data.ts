import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import type { Job, JobApplicationQuestion } from "@/features/jobs/types";

/**
 * Supabase-backed data layer. Reads go through the request-scoped server client
 * so RLS applies; `React.cache` memoizes each query for the lifetime of a single
 * request. Filtering/sorting stays in `filterAndSortJobs` downstream — these
 * helpers just return the published set (newest first) with the company joined.
 *
 * This module is server-only — it imports `@/lib/supabase/server`, which reads
 * `cookies()`.
 */

const JOB_SELECT =
  "id, slug, company_id, title, location, type, work_mode, experience, " +
  "salary_min, salary_max, currency, description, responsibilities, requirements, " +
  "perks, tags, status, created_at, no_experience_required, visa_sponsorship, language, " +
  "companies!inner ( name, slug, logo_color, logo_path )";

type Row = Record<string, unknown> & {
  companies: { name: string; slug: string; logo_color: string; logo_path: string | null };
};

function mapJobRow(row: Row): Job {
  return {
    id: row.id as string,
    slug: row.slug as string,
    companyId: row.company_id as string,
    company: {
      name: row.companies.name,
      slug: row.companies.slug,
      logoColor: row.companies.logo_color,
      logoPath: row.companies.logo_path,
    },
    title: row.title as string,
    location: row.location as string,
    type: row.type as Job["type"],
    workMode: row.work_mode as Job["workMode"],
    experience: row.experience as Job["experience"],
    salaryMin: row.salary_min as number,
    salaryMax: row.salary_max as number,
    currency: row.currency as string,
    description: row.description as string,
    responsibilities: (row.responsibilities as string[]) ?? [],
    requirements: (row.requirements as string[]) ?? [],
    perks: (row.perks as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    status: row.status as Job["status"],
    postedAt: row.created_at as string,
    noExperienceRequired: Boolean(row.no_experience_required),
    visaSponsorship: Boolean(row.visa_sponsorship),
    language: (row.language as Job["language"]) ?? "en",
  };
}

export const getJobs = cache(async (): Promise<Job[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getJobs: ${error.message}`);
  return (data as unknown as Row[]).map(mapJobRow);
});

export const getJobBySlug = cache(async (slug: string): Promise<Job | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`getJobBySlug: ${error.message}`);
  return data ? mapJobRow(data as unknown as Row) : null;
});

/** A published job by id — used where the caller already has the id, not the slug. */
export const getPublishedJobById = cache(async (id: string): Promise<Job | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`getPublishedJobById: ${error.message}`);
  return data ? mapJobRow(data as unknown as Row) : null;
});

/** The signed-in recruiter's own company id, or null. */
const getOwnCompanyId = cache(async (): Promise<string | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
});

/** Every job belonging to the recruiter's company — all statuses, newest first. */
export const getOwnJobs = cache(async (): Promise<Job[]> => {
  const companyId = await getOwnCompanyId();
  if (!companyId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getOwnJobs: ${error.message}`);
  return (data as unknown as Row[]).map(mapJobRow);
});

/** One of the recruiter's own jobs by id (any status), or null if not theirs. */
export const getOwnJob = cache(async (id: string): Promise<Job | null> => {
  const companyId = await getOwnCompanyId();
  if (!companyId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(`getOwnJob: ${error.message}`);
  return data ? mapJobRow(data as unknown as Row) : null;
});

/**
 * A job's custom application questions, ordered for display. RLS mirrors the
 * job's own visibility (published, or the owner/admin), so a seeker filling
 * out the apply form and the owning recruiter editing the job both just work.
 */
export const getJobQuestions = cache(
  async (jobId: string): Promise<JobApplicationQuestion[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("job_application_questions")
      .select("id, label, type, required, options")
      .eq("job_id", jobId)
      .order("position", { ascending: true });
    if (error) throw new Error(`getJobQuestions: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      type: row.type as JobApplicationQuestion["type"],
      required: row.required,
      options: row.options ?? [],
    }));
  },
);
