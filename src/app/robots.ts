import type { MetadataRoute } from "next";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/**
 * Keep crawlers on the public board.
 *
 * `/dashboard`, `/profile`, `/company` and `/admin` are all auth-gated, so a
 * crawler following them indexes a login redirect. `/auth` and `/onboarding`
 * carry one-time codes in query strings that should never land in an index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/company",
          "/dashboard",
          "/onboarding",
          "/profile",
          "/saved-jobs",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
