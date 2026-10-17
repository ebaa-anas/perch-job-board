import { describe, expect, it } from "vitest";

import {
  buildJobPostingJsonLd,
  serializeJsonLd,
} from "@/features/jobs/job-posting-jsonld";
import type { Job } from "@/features/jobs/types";

const SITE = "https://perch.example";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "frontend-engineer-acme",
    companyId: "22222222-2222-2222-2222-222222222222",
    company: {
      name: "Acme",
      slug: "acme",
      logoColor: "#123456",
      logoPath: null,
    },
    title: "Frontend Engineer",
    location: "Istanbul, Türkiye",
    type: "full-time",
    workMode: "hybrid",
    experience: "mid",
    salaryMin: 40000,
    salaryMax: 60000,
    currency: "USD",
    description: "Build the web app.",
    responsibilities: ["Ship features"],
    requirements: ["React"],
    perks: [],
    tags: ["react"],
    status: "published",
    postedAt: "2026-01-15T10:00:00.000Z",
    noExperienceRequired: false,
    visaSponsorship: false,
    language: "en",
    ...overrides,
  };
}

describe("buildJobPostingJsonLd", () => {
  it("emits a schema.org JobPosting", () => {
    const ld = buildJobPostingJsonLd(job(), SITE);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("JobPosting");
  });

  it("carries the fields Google for Jobs requires", () => {
    const ld = buildJobPostingJsonLd(job(), SITE);
    expect(ld.title).toBe("Frontend Engineer");
    expect(ld.description).toContain("Build the web app.");
    expect(ld.datePosted).toBe("2026-01-15T10:00:00.000Z");
    expect(ld.hiringOrganization).toMatchObject({
      "@type": "Organization",
      name: "Acme",
      sameAs: `${SITE}/companies/acme`,
    });
    expect(ld.jobLocation).toMatchObject({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Istanbul, Türkiye" },
    });
  });

  it("links back to the canonical job URL", () => {
    const ld = buildJobPostingJsonLd(job(), SITE);
    expect(ld.url).toBe(`${SITE}/jobs/frontend-engineer-acme`);
  });

  it("declares direct apply, because every application is on-site", () => {
    expect(buildJobPostingJsonLd(job(), SITE).directApply).toBe(true);
  });

  it("maps each job type onto a schema.org employmentType", () => {
    expect(buildJobPostingJsonLd(job({ type: "full-time" }), SITE).employmentType).toBe("FULL_TIME");
    expect(buildJobPostingJsonLd(job({ type: "part-time" }), SITE).employmentType).toBe("PART_TIME");
    expect(buildJobPostingJsonLd(job({ type: "contract" }), SITE).employmentType).toBe("CONTRACTOR");
    expect(buildJobPostingJsonLd(job({ type: "internship" }), SITE).employmentType).toBe("INTERN");
  });

  it("marks remote roles as telecommute", () => {
    expect(buildJobPostingJsonLd(job({ workMode: "remote" }), SITE).jobLocationType).toBe(
      "TELECOMMUTE",
    );
  });

  it("omits jobLocationType for roles with a physical location", () => {
    expect(buildJobPostingJsonLd(job({ workMode: "on-site" }), SITE)).not.toHaveProperty(
      "jobLocationType",
    );
    expect(buildJobPostingJsonLd(job({ workMode: "hybrid" }), SITE)).not.toHaveProperty(
      "jobLocationType",
    );
  });

  it("publishes the salary range as a yearly MonetaryAmount", () => {
    const ld = buildJobPostingJsonLd(job(), SITE);
    expect(ld.baseSalary).toMatchObject({
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: 40000,
        maxValue: 60000,
        unitText: "YEAR",
      },
    });
  });

  it("omits the salary entirely rather than advertising zero", () => {
    const ld = buildJobPostingJsonLd(job({ salaryMin: 0, salaryMax: 0 }), SITE);
    expect(ld).not.toHaveProperty("baseSalary");
  });

  it("folds responsibilities and requirements into the description", () => {
    const ld = buildJobPostingJsonLd(job(), SITE);
    expect(String(ld.description)).toContain("Ship features");
    expect(String(ld.description)).toContain("React");
  });

  it("tolerates a site URL with a trailing slash", () => {
    const ld = buildJobPostingJsonLd(job(), `${SITE}/`);
    expect(ld.url).toBe(`${SITE}/jobs/frontend-engineer-acme`);
  });
});

describe("serializeJsonLd", () => {
  it("escapes a closing script tag so job text cannot break out", () => {
    // The HTML parser ends a <script> block at the first literal </script>,
    // whatever the JSON says. Job titles and descriptions are recruiter
    // input, so an unescaped one is stored XSS on a public page.
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  it("escapes every '<' it finds, not just the first", () => {
    const out = serializeJsonLd({ a: "<<<" });
    expect(out).not.toContain("<");
  });

  it("still parses back to the original value", () => {
    const value = { title: "C++ <dev>", n: 3 };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it("leaves ordinary text untouched", () => {
    expect(serializeJsonLd({ a: "plain" })).toBe('{"a":"plain"}');
  });
});
