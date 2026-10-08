import { describe, expect, it } from "vitest";

import { aggregateSkillGaps } from "@/features/matching/skill-gaps";

function job(...tags: string[]) {
  return { tags };
}

describe("aggregateSkillGaps", () => {
  it("is empty when the seeker already has everything asked for", () => {
    const result = aggregateSkillGaps([job("react")], ["React"]);
    expect(result).toEqual([]);
  });

  it("is empty when there are no jobs to learn from", () => {
    expect(aggregateSkillGaps([], ["react"])).toEqual([]);
  });

  it("reports a skill the seeker is missing", () => {
    const result = aggregateSkillGaps([job("react", "graphql")], ["react"]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("graphql");
    expect(result[0].jobCount).toBe(1);
  });

  it("ranks by how many of the seeker's jobs ask for it", () => {
    const result = aggregateSkillGaps(
      [job("docker", "graphql"), job("docker"), job("docker"), job("graphql")],
      [],
    );
    expect(result.map((g) => g.label)).toEqual(["docker", "graphql"]);
    expect(result[0].jobCount).toBe(3);
    expect(result[1].jobCount).toBe(2);
  });

  it("reports the share of jobs asking for it", () => {
    const result = aggregateSkillGaps([job("docker"), job("docker"), job("x"), job("y")], []);
    expect(result[0].share).toBe(50);
  });

  it("counts a skill once per job even if the job repeats it", () => {
    const result = aggregateSkillGaps([job("docker", "Docker", "docker")], []);
    expect(result[0].jobCount).toBe(1);
  });

  it("treats differently-spelled skills as one", () => {
    const result = aggregateSkillGaps([job("Next.js"), job("next js"), job("NEXTJS")], []);
    expect(result).toHaveLength(1);
    expect(result[0].jobCount).toBe(3);
  });

  it("labels a skill with its most common spelling", () => {
    const result = aggregateSkillGaps(
      [job("next js"), job("Next.js"), job("Next.js")],
      [],
    );
    expect(result[0].label).toBe("Next.js");
  });

  it("breaks a spelling tie by first appearance, so the label is stable", () => {
    const result = aggregateSkillGaps([job("next js"), job("Next.js")], []);
    expect(result[0].label).toBe("next js");
  });

  it("excludes skills the seeker lists, however spelled", () => {
    const result = aggregateSkillGaps([job("Next.js", "docker")], ["next js"]);
    expect(result.map((g) => g.label)).toEqual(["docker"]);
  });

  it("ignores unmatchable tags", () => {
    const result = aggregateSkillGaps([job("---", "  ", "docker")], []);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("docker");
  });

  it("breaks a count tie alphabetically, so the order is deterministic", () => {
    const result = aggregateSkillGaps([job("zebra", "apple")], []);
    expect(result.map((g) => g.label)).toEqual(["apple", "zebra"]);
  });

  it("caps the list at the requested size", () => {
    const tags = ["a", "b", "c", "d", "e", "f"];
    const result = aggregateSkillGaps([job(...tags)], [], 3);
    expect(result).toHaveLength(3);
  });

  it("defaults to a short, actionable list rather than everything", () => {
    const tags = Array.from({ length: 30 }, (_, i) => `skill${i}`);
    const result = aggregateSkillGaps([job(...tags)], []);
    expect(result.length).toBeLessThanOrEqual(8);
  });
});
