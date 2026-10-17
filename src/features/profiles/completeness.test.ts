import { describe, expect, it } from "vitest";

import {
  computeCompleteness,
  type CompletenessInput,
} from "@/features/profiles/completeness";

function profile(overrides: Partial<CompletenessInput> = {}): CompletenessInput {
  return {
    headline: null,
    bio: null,
    skills: [],
    hasCv: false,
    experience: null,
    noProfessionalExperience: null,
    needsVisaSponsorship: null,
    desiredTypes: [],
    desiredWorkModes: [],
    ...overrides,
  };
}

describe("computeCompleteness", () => {
  it("is 0 for an empty profile", () => {
    expect(computeCompleteness(profile()).percent).toBe(0);
  });

  it("is 100 when everything is answered", () => {
    const result = computeCompleteness(
      profile({
        headline: "Mobile Developer",
        bio: "Passionate mobile developer",
        skills: ["flutter"],
        hasCv: true,
        experience: "mid",
        needsVisaSponsorship: false,
        desiredTypes: ["full-time"],
        desiredWorkModes: ["remote"],
      }),
    );
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it("counts each answered item", () => {
    const result = computeCompleteness(profile({ headline: "x" }));
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });

  it("accepts 'no professional experience' as an answer to experience", () => {
    // Someone with no experience yet has answered the question; the board's
    // whole early-career wedge depends on that being a real answer.
    const result = computeCompleteness(
      profile({ noProfessionalExperience: true }),
    );
    expect(result.missing.map((m) => m.id)).not.toContain("experience");
  });

  it("treats false as answered for work authorisation", () => {
    const answered = computeCompleteness(profile({ needsVisaSponsorship: false }));
    expect(answered.missing.map((m) => m.id)).not.toContain("workAuthorization");
  });

  it("treats null as unanswered for work authorisation", () => {
    const blank = computeCompleteness(profile({ needsVisaSponsorship: null }));
    expect(blank.missing.map((m) => m.id)).toContain("workAuthorization");
  });

  it("ignores whitespace-only text", () => {
    const result = computeCompleteness(profile({ headline: "   ", bio: "\n" }));
    expect(result.percent).toBe(0);
  });

  it("orders what is missing by how much it is worth", () => {
    const result = computeCompleteness(profile());
    const weights = result.missing.map((m) => m.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("gives every missing item a payoff to show the seeker", () => {
    for (const item of computeCompleteness(profile()).missing) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.weight).toBeGreaterThan(0);
    }
  });

  it("names the single highest-value next step", () => {
    const result = computeCompleteness(profile({ headline: "x", skills: ["a"] }));
    expect(result.next).not.toBeNull();
    expect(result.next!.id).toBe(result.missing[0].id);
  });

  it("has no next step once complete", () => {
    const result = computeCompleteness(
      profile({
        headline: "x",
        bio: "y",
        skills: ["a"],
        hasCv: true,
        experience: "junior",
        needsVisaSponsorship: true,
        desiredTypes: ["internship"],
        desiredWorkModes: ["hybrid"],
      }),
    );
    expect(result.next).toBeNull();
  });

  it("never exceeds 100 or drops below 0", () => {
    const full = computeCompleteness(
      profile({
        headline: "x",
        bio: "y",
        skills: ["a", "b", "c"],
        hasCv: true,
        experience: "lead",
        noProfessionalExperience: false,
        needsVisaSponsorship: true,
        desiredTypes: ["full-time", "contract"],
        desiredWorkModes: ["remote", "hybrid"],
      }),
    );
    expect(full.percent).toBeLessThanOrEqual(100);
    expect(full.percent).toBeGreaterThanOrEqual(0);
  });
});
