import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import type { Job } from "@/features/jobs/types";

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
}

const COMPANY_COLUMNS =
  "id, owner_id, name, slug, tagline, description, website, logo_path, logo_color";

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
  };
}

/** The signed-in recruiter's own company row, or null if they haven't made one. */
export const getOwnCompany = cache(async (): Promise<Company | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("owner_id", user.id)
    .maybeSingle();
  return data ? mapCompany(data as CompanyRow) : null;
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
