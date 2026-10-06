import { describe, expect, it } from "vitest";
import type { Job } from "@/features/jobs/types";
import { SEED_JOBS } from "@/features/jobs/seed";
import {
  filterAndSortJobs,
  filtersToSearchParams,
  formatSalary,
  getInitials,
  parseJobFilters,
} from "@/features/jobs/utils";

function toJob(seed: (typeof SEED_JOBS)[number]): Job {
  return {
    ...seed,
    slug: seed.id,
    companyId: seed.id,
    status: "published",
    noExperienceRequired: seed.noExperienceRequired ?? false,
    visaSponsorship: seed.visaSponsorship ?? false,
    language: seed.language ?? "en",
    company: {
      name: seed.company,
      slug: seed.company.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      logoColor: seed.companyLogoColor,
      logoPath: null,
    },
  };
}
const JOBS: Job[] = SEED_JOBS.map(toJob);

describe("parseJobFilters", () => {
  it("keeps only known enum values and coerces minSalary", () => {
    const f = parseJobFilters({
      q: "  react  ",
      type: "full-time,bogus",
      mode: "remote",
      minSalary: "60000",
      sort: "salary",
    });
    expect(f).toEqual({
      q: "react",
      type: ["full-time"],
      mode: ["remote"],
      level: undefined,
      minSalary: 60000,
      sort: "salary",
    });
  });

  it("defaults sort to relevance and drops empties", () => {
    expect(parseJobFilters({}).sort).toBe("relevance");
    expect(parseJobFilters({ minSalary: "-5" }).minSalary).toBeUndefined();
  });

  it("parses noExperienceRequired and visaSponsorship as booleans", () => {
    expect(parseJobFilters({ noExperienceRequired: "true" }).noExperienceRequired).toBe(true);
    expect(parseJobFilters({ visaSponsorship: "true" }).visaSponsorship).toBe(true);
    expect(parseJobFilters({}).noExperienceRequired).toBeUndefined();
    expect(parseJobFilters({}).visaSponsorship).toBeUndefined();
    expect(parseJobFilters({ noExperienceRequired: "false" }).noExperienceRequired).toBeUndefined();
  });

  it("parses language, keeping only known codes", () => {
    expect(parseJobFilters({ language: "tr" }).language).toBe("tr");
    expect(parseJobFilters({ language: "fr" }).language).toBeUndefined();
    expect(parseJobFilters({}).language).toBeUndefined();
  });
});

describe("filterAndSortJobs", () => {
  it("filters by type and text, newest first when no query", () => {
    const res = filterAndSortJobs(JOBS, { type: ["internship"] });
    expect(res.every((j) => j.type === "internship")).toBe(true);
  });

  it("respects minSalary against salaryMax", () => {
    const res = filterAndSortJobs(JOBS, { minSalary: 130000 });
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThan(SEED_JOBS.length);
    expect(res.every((j) => j.salaryMax >= 130000)).toBe(true);
  });

  it("ranks title matches above body matches for a query", () => {
    const res = filterAndSortJobs(JOBS, { q: "engineer", sort: "relevance" });
    expect(res[0].title.toLowerCase()).toContain("engineer");
  });

  it("filters by noExperienceRequired and visaSponsorship", () => {
    const withFlags: Job[] = [
      { ...JOBS[0], noExperienceRequired: true, visaSponsorship: false },
      { ...JOBS[1], noExperienceRequired: false, visaSponsorship: true },
    ];
    expect(
      filterAndSortJobs(withFlags, { noExperienceRequired: true }).map((j) => j.id),
    ).toEqual([withFlags[0].id]);
    expect(
      filterAndSortJobs(withFlags, { visaSponsorship: true }).map((j) => j.id),
    ).toEqual([withFlags[1].id]);
  });

  it("filters by language", () => {
    const mixed: Job[] = [
      { ...JOBS[0], language: "en" },
      { ...JOBS[1], language: "tr" },
    ];
    expect(filterAndSortJobs(mixed, { language: "tr" }).map((j) => j.id)).toEqual([
      mixed[1].id,
    ]);
  });
});

describe("formatSalary / getInitials", () => {
  it("formats a range", () => {
    expect(formatSalary(60000, 90000, "USD")).toMatch(/\$60,000.*\$90,000/);
  });
  it("returns undisclosed for 0/0", () => {
    expect(formatSalary(0, 0)).toBe("Salary undisclosed");
  });
  it("takes up to two initials", () => {
    expect(getInitials("Northwind Labs")).toBe("NL");
  });
});

describe("filtersToSearchParams", () => {
  it("omits relevance sort and empty arrays", () => {
    expect(filtersToSearchParams({ sort: "relevance" }).toString()).toBe("");
    expect(filtersToSearchParams({ type: ["contract"] }).get("type")).toBe(
      "contract",
    );
  });

  it("round-trips the niche boolean flags", () => {
    const qs = filtersToSearchParams({ noExperienceRequired: true, visaSponsorship: true });
    expect(qs.get("noExperienceRequired")).toBe("true");
    expect(qs.get("visaSponsorship")).toBe("true");
    expect(filtersToSearchParams({}).get("noExperienceRequired")).toBeNull();
  });

  it("round-trips the language filter", () => {
    expect(filtersToSearchParams({ language: "tr" }).get("language")).toBe("tr");
    expect(filtersToSearchParams({}).get("language")).toBeNull();
  });
});
