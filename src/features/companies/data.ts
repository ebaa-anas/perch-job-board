import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import type { ContentLanguage, Job } from "@/features/jobs/types";

export interface Company {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  logoPath: string | null;
  logoColor: string;
  language: ContentLanguage;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

const COMPANY_COLUMNS =
  "id, owner_id, name, slug, tagline, description, website, logo_path, logo_color, language, suspended_at, suspended_reason";

type CompanyRow = {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  logo_path: string | null;
  logo_color: string;
  language: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
};

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    website: row.website,
    logoPath: row.logo_path,
    logoColor: row.logo_color,
    language: (row.language as ContentLanguage) ?? "en",
    suspendedAt: row.suspended_at,
    suspendedReason: row.suspended_reason,
  };
}

/**
 * The company the signed-in recruiter belongs to, or null if they belong to
 * none.
 *
 * Resolved through `company_members`, not `companies.owner_id`: since
 * migration 0018 a company can have several recruiters, and an invited member
 * must see the same company their owner does. Membership is one-per-person, so
 * this stays single-valued and every existing caller is unaffected.
 */
export const getOwnCompany = cache(async (): Promise<Company | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select(`companies!inner ( ${COMPANY_COLUMNS} )`)
    .eq("profile_id", user.id)
    .maybeSingle();

  const row = (data as unknown as { companies: CompanyRow } | null)?.companies;
  return row ? mapCompany(row) : null;
});

export const getCompanyBySlug = cache(
  async (slug: string): Promise<Company | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    return data ? mapCompany(data as CompanyRow) : null;
  },
);

/** Published jobs for a company, newest first — reuses the jobs read contract. */
export const getCompanyJobs = cache(
  async (companyId: string): Promise<Job[]> => {
    const { getJobs } = await import("@/features/jobs/data");
    const all = await getJobs();
    return all.filter((job) => job.companyId === companyId);
  },
);
