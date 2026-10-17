import type { Job, JobType } from "@/features/jobs/types";

/**
 * schema.org `JobPosting` structured data.
 *
 * This is what makes a listing eligible for Google for Jobs, which is the
 * cheapest acquisition channel a job board has — without it the board is
 * invisible to the surface most seekers actually start from. Pure and
 * synchronous so it can be asserted on directly in tests.
 */

const EMPLOYMENT_TYPES: Record<JobType, string> = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
};

function bulletList(heading: string, items: string[]): string {
  if (items.length === 0) return "";
  return `\n\n${heading}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

export function buildJobPostingJsonLd(
  job: Job,
  siteUrl: string,
): Record<string, unknown> {
  const origin = siteUrl.replace(/\/+$/, "");

  const description = [
    job.description,
    bulletList("Responsibilities", job.responsibilities),
    bulletList("Requirements", job.requirements),
    bulletList("Perks", job.perks),
  ].join("");

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    datePosted: job.postedAt,
    employmentType: EMPLOYMENT_TYPES[job.type],
    url: `${origin}/jobs/${job.slug}`,
    identifier: {
      "@type": "PropertyValue",
      name: job.company.name,
      value: job.id,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: `${origin}/companies/${job.company.slug}`,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
      },
    },
    // Every application is submitted on Perch (migration 0011 retired
    // external apply), which is exactly what `directApply` asserts.
    directApply: true,
  };

  if (job.workMode === "remote") {
    ld.jobLocationType = "TELECOMMUTE";
  }

  // A posting with a zero range is one where the recruiter declined to say;
  // publishing "0" would be worse than publishing nothing.
  if (job.salaryMax > 0) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency,
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salaryMin,
        maxValue: job.salaryMax,
        unitText: "YEAR",
      },
    };
  }

  if (job.visaSponsorship) {
    ld.jobBenefits = "Visa sponsorship available";
  }

  return ld;
}

/**
 * Serialise structured data for embedding in a <script> tag.
 *
 * `JSON.stringify` alone is unsafe here. The HTML parser closes a script
 * block at the first literal `</script>` regardless of JSON syntax, and this
 * payload carries recruiter-authored job titles and descriptions — so an
 * unescaped one is stored XSS on a public page. Escaping `<` as its unicode
 * form keeps the JSON byte-identical in meaning while making a closing tag
 * impossible to express.
 */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
