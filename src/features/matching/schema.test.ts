import { describe, expect, it } from "vitest";

import { fitAssessmentSchema } from "@/features/matching/schema";

const VALID = {
  score: 78,
  summary: "Strong match on React and TypeScript, light on backend experience.",
  strengths: ["React", "TypeScript"],
  gaps: ["No backend experience listed"],
};

describe("fitAssessmentSchema", () => {
  it("accepts a well-formed assessment", () => {
    expect(fitAssessmentSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a score outside 0-100", () => {
    expect(fitAssessmentSchema.safeParse({ ...VALID, score: 101 }).success).toBe(false);
    expect(fitAssessmentSchema.safeParse({ ...VALID, score: -1 }).success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    expect(fitAssessmentSchema.safeParse({ ...VALID, score: 77.5 }).success).toBe(false);
  });

  it("rejects a summary over 200 characters", () => {
    expect(
      fitAssessmentSchema.safeParse({ ...VALID, summary: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("defaults strengths and gaps to an empty array when omitted", () => {
    const result = fitAssessmentSchema.parse({ score: VALID.score, summary: VALID.summary });
    expect(result.strengths).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it("rejects more than 4 strengths", () => {
    expect(
      fitAssessmentSchema.safeParse({
        ...VALID,
        strengths: ["a", "b", "c", "d", "e"],
      }).success,
    ).toBe(false);
  });
});
