import { describe, expect, it } from "vitest";

import { lintInclusiveLanguage } from "@/features/jobs/inclusive-language";

describe("lintInclusiveLanguage", () => {
  it("finds nothing in neutral copy", () => {
    const result = lintInclusiveLanguage(
      "We are looking for an engineer to build and maintain our web application.",
    );
    expect(result).toEqual([]);
  });

  it("is empty for empty input", () => {
    expect(lintInclusiveLanguage("")).toEqual([]);
    expect(lintInclusiveLanguage("   ")).toEqual([]);
  });

  it("flags gendered wording and suggests a replacement", () => {
    const result = lintInclusiveLanguage("We need a rockstar salesman.");
    const terms = result.map((f) => f.term);
    expect(terms).toContain("salesman");
    const salesman = result.find((f) => f.term === "salesman");
    expect(salesman?.suggestion).toBeTruthy();
    expect(salesman?.category).toBe("gendered");
  });

  it("flags age-coded wording", () => {
    const result = lintInclusiveLanguage("Looking for a young, digital native grad.");
    expect(result.map((f) => f.term)).toContain("digital native");
  });

  it("flags exclusionary physical requirements", () => {
    const result = lintInclusiveLanguage("Must be able to stand for long periods.");
    expect(result.some((f) => f.category === "ableist")).toBe(true);
  });

  it("flags culture-coded jargon that narrows the pool", () => {
    const result = lintInclusiveLanguage("We want a rockstar ninja to crush it.");
    const terms = result.map((f) => f.term);
    expect(terms).toContain("rockstar");
    expect(terms).toContain("ninja");
  });

  it("matches case-insensitively", () => {
    expect(lintInclusiveLanguage("A ROCKSTAR engineer").map((f) => f.term)).toContain(
      "rockstar",
    );
  });

  it("matches only whole words, so 'hemanager' is not 'he'", () => {
    expect(lintInclusiveLanguage("The hemanager role")).toEqual([]);
    expect(lintInclusiveLanguage("Chairmanship aside")).toEqual([]);
  });

  it("reports a term once however many times it appears", () => {
    const result = lintInclusiveLanguage("rockstar rockstar rockstar");
    expect(result.filter((f) => f.term === "rockstar")).toHaveLength(1);
  });

  it("counts the occurrences it collapsed", () => {
    const result = lintInclusiveLanguage("A rockstar and another rockstar");
    expect(result.find((f) => f.term === "rockstar")?.occurrences).toBe(2);
  });

  it("finds multi-word phrases", () => {
    expect(
      lintInclusiveLanguage("He is the right culture fit").map((f) => f.term),
    ).toContain("culture fit");
  });

  it("handles punctuation around a term", () => {
    expect(lintInclusiveLanguage("Wanted: rockstar, urgently!").map((f) => f.term)).toContain(
      "rockstar",
    );
  });

  it("orders findings by their position in the text", () => {
    const result = lintInclusiveLanguage("A salesman who is also a rockstar");
    expect(result.map((f) => f.term)).toEqual(["salesman", "rockstar"]);
  });

  it("gives every finding a category and a suggestion", () => {
    const result = lintInclusiveLanguage(
      "A young rockstar salesman who must stand for long periods and is a culture fit.",
    );
    expect(result.length).toBeGreaterThan(3);
    for (const finding of result) {
      expect(finding.category).toBeTruthy();
      expect(finding.suggestion.length).toBeGreaterThan(0);
      expect(finding.occurrences).toBeGreaterThan(0);
    }
  });
});
