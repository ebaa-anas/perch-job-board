import type { MetadataRoute } from "next";

import {
  getListedCompanyEntries,
  getPublishedJobEntries,
} from "@/features/seo/data";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/**
 * Only public, indexable surfaces belong here. Everything behind auth
 * (`/dashboard`, `/profile`, `/company`, `/admin`) is excluded both here and
 * in `robots.ts` — listing a page a crawler cannot reach wastes crawl budget
 * and surfaces login walls in results.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies] = await Promise.all([
    getPublishedJobEntries(),
    getListedCompanyEntries(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/jobs`, changeFrequency: "hourly", priority: 0.9 },
  ];

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((entry) => ({
    url: `${SITE_URL}/jobs/${entry.slug}`,
    lastModified: new Date(entry.lastModified),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const companyRoutes: MetadataRoute.Sitemap = companies.map((entry) => ({
    url: `${SITE_URL}/companies/${entry.slug}`,
    lastModified: new Date(entry.lastModified),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...jobRoutes, ...companyRoutes];
}

/** Jobs appear and close constantly; an hour-stale sitemap is the right trade. */
export const revalidate = 3600;
