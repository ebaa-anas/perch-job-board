import { describe, expect, it } from "vitest";

import {
  normaliseSkill,
  scoreApplicant,
  sortByMatch,
} from "@/features/matching/applicant-match";

describe("normaliseSkill", () => {
  it("lowercases and trims", () => {
    expect(normaliseSkill("  React  ")).toBe("react");
  });

  it("ignores punctuation and spacing, so Next.js and next js agree", () => {
    expect(normaliseSkill("Next.js")).toBe(normaliseSkill("next js"));
    expect(normaliseSkill("node-js")).toBe(normaliseSkill("Node.JS"));
  });

  it("keeps digits, which carry meaning in skill names", () => {
    expect(normaliseSkill("Vue 3")).toBe("vue3");
    expect(normaliseSkill("c++")).toBe("c");
  });

  it("collapses to empty for a value with nothing matchable", () => {
    expect(normaliseSkill("   ")).toBe("");
    expect(normaliseSkill("---")).toBe("");
  });
});

describe("scoreApplicant", () => {
  it("is 100 when the candidate has every tag", () => {
    const result = scoreApplicant({
      jobTags: ["React", "TypeScript"],
      seekerSkills: ["react", "typescript"],
    });
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it("is 0 when the candidate has none of them", () => {
    const result = scoreApplicant({
      jobTags: ["React", "TypeScript"],
      seekerSkills: ["cobol"],
    });
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
  });

  it("reports the share of tags covered", () => {
    const result = scoreApplicant({
      jobTags: ["a", "b", "c", "d"],
      seekerSkills: ["a", "b"],
    });
    expect(result.score).toBe(50);
  });

  it("rounds to a whole percentage", () => {
    const result = scoreApplicant({
      jobTags: ["a", "b", "c"],
      seekerSkills: ["a"],
    });
    expect(result.score).toBe(33);
  });

  it("matches case- and punctuation-insensitively", () => {
    const result = scoreApplicant({
      jobTags: ["Next.js", "Node-JS"],
      seekerSkills: ["NEXT JS", "node.js"],
    });
    expect(result.score).toBe(100);
  });

  it("reports matched and missing using the job's own spelling, for display", () => {
    const result = scoreApplicant({
      jobTags: ["Next.js", "Kubernetes"],
      seekerSkills: ["next js"],
    });
    expect(result.matched).toEqual(["Next.js"]);
    expect(result.missing).toEqual(["Kubernetes"]);
  });

  it("preserves the job's tag order in both lists", () => {
    const result = scoreApplicant({
      jobTags: ["z", "a", "m"],
      seekerSkills: ["m", "z"],
    });
    expect(result.matched).toEqual(["z", "m"]);
    expect(result.missing).toEqual(["a"]);
  });

  it("is null when the job lists no tags, rather than 0", () => {
    // A job with nothing to match against has no match score; reporting 0
    // would rank every applicant as a bad fit for the recruiter's own omission.
    const result = scoreApplicant({ jobTags: [], seekerSkills: ["react"] });
    expect(result.score).toBeNull();
  });

  it("is 0, not null, when the job has tags and the candidate has no skills", () => {
    const result = scoreApplicant({ jobTags: ["react"], seekerSkills: [] });
    expect(result.score).toBe(0);
  });

  it("does not let extra candidate skills push it above 100", () => {
    const result = scoreApplicant({
      jobTags: ["react"],
      seekerSkills: ["react", "vue", "svelte", "angular"],
    });
    expect(result.score).toBe(100);
  });

  it("counts a duplicated job tag once", () => {
    const result = scoreApplicant({
      jobTags: ["React", "react", "Vue"],
      seekerSkills: ["react"],
    });
    expect(result.score).toBe(50);
    expect(result.matched).toEqual(["React"]);
    expect(result.missing).toEqual(["Vue"]);
  });

  it("ignores unmatchable tags and skills", () => {
    const result = scoreApplicant({
      jobTags: ["React", "---"],
      seekerSkills: ["react", "  "],
    });
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });
});

describe("sortByMatch", () => {
  const rows = [
    { id: "low", score: 10 },
    { id: "high", score: 90 },
    { id: "none", score: null },
    { id: "mid", score: 50 },
  ];

  it("orders by score, highest first", () => {
    expect(sortByMatch(rows, (r) => r.score).map((r) => r.id)).toEqual([
      "high",
      "mid",
      "low",
      "none",
    ]);
  });

  it("puts unscored rows last rather than treating them as zero", () => {
    const result = sortByMatch(
      [
        { id: "none", score: null },
        { id: "zero", score: 0 },
      ],
      (r) => r.score,
    );
    expect(result.map((r) => r.id)).toEqual(["zero", "none"]);
  });

  it("does not mutate the input", () => {
    const input = [...rows];
    sortByMatch(input, (r) => r.score);
    expect(input.map((r) => r.id)).toEqual(["low", "high", "none", "mid"]);
  });

  it("is stable for equal scores", () => {
    const tied = [
      { id: "first", score: 50 },
      { id: "second", score: 50 },
      { id: "third", score: 50 },
    ];
    expect(sortByMatch(tied, (r) => r.score).map((r) => r.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
