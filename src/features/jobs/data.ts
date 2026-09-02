import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/features/jobs/types";

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
  "perks, tags, apply_url, status, created_at, " +
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
    applyUrl: (row.apply_url as string | null) ?? null,
    status: row.status as Job["status"],
    postedAt: row.created_at as string,
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
