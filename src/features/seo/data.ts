import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Data for `sitemap.xml` and `robots.txt`.
 *
 * Deliberately on the service-role client rather than the request-scoped one:
 * the sitemap is public, identical for every visitor, and must not vary by
 * session. Reading `cookies()` here would opt the route out of caching and
 * make every crawl hit the database. The `status = 'published'` filter is what
 * keeps drafts out — not RLS.
 */

export interface SitemapEntry {
  slug: string;
  lastModified: string;
}

export async function getPublishedJobEntries(): Promise<SitemapEntry[]> {
  const { data, error } = await createAdminClient()
    .from("jobs")
    .select("slug, updated_at, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (error) {
    console.error("[sitemap] job entries failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    lastModified: row.updated_at ?? row.created_at,
  }));
}

/**
 * Companies that have at least one published job. A company page with nothing
 * to apply to is a thin-content page; submitting those to a crawler costs
 * crawl budget and earns nothing.
 */
export async function getListedCompanyEntries(): Promise<SitemapEntry[]> {
  const { data, error } = await createAdminClient()
    .from("jobs")
    .select("created_at, companies!inner ( slug )")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (error) {
    console.error("[sitemap] company entries failed", error);
    return [];
  }

  type Row = { created_at: string; companies: { slug: string } };
  const newestBySlug = new Map<string, string>();
  for (const row of (data as unknown as Row[]) ?? []) {
    const slug = row.companies?.slug;
    if (!slug || newestBySlug.has(slug)) continue;
    newestBySlug.set(slug, row.created_at);
  }

  return Array.from(newestBySlug, ([slug, lastModified]) => ({ slug, lastModified }));
}
