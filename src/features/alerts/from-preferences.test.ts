import { describe, expect, it } from "vitest";

import { preferencesToQuery } from "@/features/alerts/from-preferences";
import { parseJobFilters } from "@/features/jobs/utils";

const blank = {
  desiredTypes: [],
  desiredWorkModes: [],
  experience: null,
  noProfessionalExperience: null,
  needsVisaSponsorship: null,
};

describe("preferencesToQuery", () => {
  it("is empty when nothing is set", () => {
    expect(preferencesToQuery(blank)).toBe("");
  });

  it("carries desired job types", () => {
    const q = preferencesToQuery({ ...blank, desiredTypes: ["internship"] });
    expect(parseJobFilters(Object.fromEntries(new URLSearchParams(q))).type).toEqual([
      "internship",
    ]);
  });

  it("carries several types and modes together", () => {
    const q = preferencesToQuery({
      ...blank,
      desiredTypes: ["full-time", "contract"],
      desiredWorkModes: ["remote", "hybrid"],
    });
    const filters = parseJobFilters(Object.fromEntries(new URLSearchParams(q)));
    expect(filters.type).toEqual(["full-time", "contract"]);
    expect(filters.mode).toEqual(["remote", "hybrid"]);
  });

  it("carries experience as the job-side level filter", () => {
    const q = preferencesToQuery({ ...blank, experience: "senior" });
    expect(parseJobFilters(Object.fromEntries(new URLSearchParams(q))).level).toEqual([
      "senior",
    ]);
  });

  it("asks for entry-level roles when the seeker has no experience yet", () => {
    const q = preferencesToQuery({ ...blank, noProfessionalExperience: true });
    const filters = parseJobFilters(Object.fromEntries(new URLSearchParams(q)));
    expect(filters.noExperienceRequired).toBe(true);
  });

  it("asks for sponsoring roles only when the seeker needs sponsorship", () => {
    const needs = preferencesToQuery({ ...blank, needsVisaSponsorship: true });
    expect(
      parseJobFilters(Object.fromEntries(new URLSearchParams(needs))).visaSponsorship,
    ).toBe(true);

    const doesNot = preferencesToQuery({ ...blank, needsVisaSponsorship: false });
    expect(
      parseJobFilters(Object.fromEntries(new URLSearchParams(doesNot))).visaSponsorship,
    ).toBeUndefined();
  });

  it("ignores a null answer rather than filtering on it", () => {
    expect(preferencesToQuery({ ...blank, needsVisaSponsorship: null })).toBe("");
    expect(preferencesToQuery({ ...blank, noProfessionalExperience: null })).toBe("");
  });

  it("prefers the explicit level over the entry-level flag when both are set", () => {
    const q = preferencesToQuery({
      ...blank,
      experience: "junior",
      noProfessionalExperience: true,
    });
    const filters = parseJobFilters(Object.fromEntries(new URLSearchParams(q)));
    expect(filters.level).toEqual(["junior"]);
    expect(filters.noExperienceRequired).toBe(true);
  });

  it("round-trips through the browse page's own parser", () => {
    // The whole point: an alert built from preferences must mean exactly what
    // the same query means on /jobs.
    const q = preferencesToQuery({
      desiredTypes: ["internship"],
      desiredWorkModes: ["remote"],
      experience: "junior",
      noProfessionalExperience: true,
      needsVisaSponsorship: true,
    });
    const filters = parseJobFilters(Object.fromEntries(new URLSearchParams(q)));
    expect(filters).toMatchObject({
      type: ["internship"],
      mode: ["remote"],
      level: ["junior"],
      noExperienceRequired: true,
      visaSponsorship: true,
    });
  });
});
