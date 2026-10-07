import { describe, expect, it } from "vitest";

import { describeFilters } from "@/features/alerts/describe";

describe("describeFilters", () => {
  it("names the unfiltered board plainly", () => {
    expect(describeFilters({})).toBe("All jobs");
    expect(describeFilters({ sort: "relevance" })).toBe("All jobs");
  });

  it("ignores sort, which does not change what matches", () => {
    expect(describeFilters({ sort: "salary" })).toBe("All jobs");
  });

  it("quotes the search term and still reads as a label", () => {
    expect(describeFilters({ q: "rust" })).toBe("“rust” jobs");
  });

  it("names a single work mode", () => {
    expect(describeFilters({ mode: ["remote"] })).toBe("Remote jobs");
  });

  it("combines a term with filters", () => {
    expect(describeFilters({ q: "rust", mode: ["remote"] })).toBe("Remote “rust” jobs");
  });

  it("joins multiple values of one facet", () => {
    expect(describeFilters({ type: ["full-time", "internship"] })).toBe(
      "Full-time, Internship jobs",
    );
  });

  it("mentions the niche flags, which are the whole point of saving them", () => {
    expect(describeFilters({ visaSponsorship: true })).toContain("visa sponsorship");
    expect(describeFilters({ noExperienceRequired: true })).toContain("no experience");
  });

  it("mentions a salary floor", () => {
    expect(describeFilters({ minSalary: 50000 })).toContain("50,000");
  });

  it("stays within the 80-character limit the label column allows", () => {
    const label = describeFilters({
      q: "senior staff distributed systems engineer with kubernetes",
      type: ["full-time", "part-time", "contract", "internship"],
      mode: ["remote", "hybrid", "on-site"],
      level: ["junior", "mid", "senior", "lead"],
      minSalary: 250000,
      visaSponsorship: true,
      noExperienceRequired: true,
    });
    expect(label.length).toBeLessThanOrEqual(80);
  });
});
