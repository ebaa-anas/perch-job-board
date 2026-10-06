import { describe, expect, it } from "vitest";

import { buildFitScoreInput, extractJson } from "@/features/matching/prompt";

const PROFILE = {
  headline: "Frontend engineer",
  bio: "I build accessible UIs.",
  skills: ["React", "TypeScript"],
};

const JOB = {
  title: "Frontend Engineer",
  description: "Build our design system.",
  requirements: ["3+ years React"],
  tags: ["React", "CSS"],
  experience: "mid" as const,
  type: "full-time" as const,
};

describe("buildFitScoreInput", () => {
  it("includes the profile and job content", () => {
    const input = buildFitScoreInput(PROFILE, JOB);
    expect(input).toContain("Frontend engineer");
    expect(input).toContain("Build our design system.");
    expect(input).toContain("3+ years React");
  });

  it("is stable regardless of skills/tags array order", () => {
    const a = buildFitScoreInput(PROFILE, JOB);
    const b = buildFitScoreInput(
      { ...PROFILE, skills: ["TypeScript", "React"] },
      { ...JOB, tags: ["CSS", "React"] },
    );
    expect(a).toBe(b);
  });

  it("changes when the job description changes", () => {
    const a = buildFitScoreInput(PROFILE, JOB);
    const b = buildFitScoreInput(PROFILE, { ...JOB, description: "Something else." });
    expect(a).not.toBe(b);
  });

  it("changes when the profile skills change", () => {
    const a = buildFitScoreInput(PROFILE, JOB);
    const b = buildFitScoreInput({ ...PROFILE, skills: ["Vue"] }, JOB);
    expect(a).not.toBe(b);
  });
});

describe("extractJson", () => {
  it("returns plain JSON unchanged", () => {
    expect(extractJson('{"score":80}')).toBe('{"score":80}');
  });

  it("strips a ```json code fence", () => {
    expect(extractJson('```json\n{"score":80}\n```')).toBe('{"score":80}');
  });

  it("strips a bare ``` code fence", () => {
    expect(extractJson('```\n{"score":80}\n```')).toBe('{"score":80}');
  });

  it("trims surrounding whitespace", () => {
    expect(extractJson('  \n{"score":80}\n  ')).toBe('{"score":80}');
  });
});
