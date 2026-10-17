import { describe, expect, it } from "vitest";

import {
  buildSkillCorpus,
  classifySkills,
  editDistance,
  findCloseMatch,
} from "@/features/profiles/skill-suggestions";

function job(...tags: string[]) {
  return { tags };
}

describe("buildSkillCorpus", () => {
  it("is empty with no jobs", () => {
    expect(buildSkillCorpus([])).toEqual([]);
  });

  it("counts how many jobs ask for each tag", () => {
    const corpus = buildSkillCorpus([job("react"), job("react"), job("vue")]);
    expect(corpus[0]).toMatchObject({ label: "react", count: 2 });
    expect(corpus[1]).toMatchObject({ label: "vue", count: 1 });
  });

  it("counts a tag once per job even when repeated", () => {
    const corpus = buildSkillCorpus([job("react", "React", "REACT")]);
    expect(corpus[0].count).toBe(1);
  });

  it("merges spellings and shows the commonest one", () => {
    const corpus = buildSkillCorpus([
      job("next js"),
      job("Next.js"),
      job("Next.js"),
    ]);
    expect(corpus).toHaveLength(1);
    expect(corpus[0].label).toBe("Next.js");
    expect(corpus[0].count).toBe(3);
  });

  it("ranks by frequency, then alphabetically for a stable order", () => {
    const corpus = buildSkillCorpus([job("zebra", "apple"), job("apple")]);
    expect(corpus.map((s) => s.label)).toEqual(["apple", "zebra"]);
  });

  it("ignores tags with nothing matchable in them", () => {
    expect(buildSkillCorpus([job("---", "   ", "react")])).toHaveLength(1);
  });
});

describe("editDistance", () => {
  it("is 0 for identical strings", () => {
    expect(editDistance("react", "react")).toBe(0);
  });

  it("counts a single insertion", () => {
    expect(editDistance("postgresql", "postegresql")).toBe(1);
  });

  it("counts a single substitution", () => {
    expect(editDistance("react", "raect")).toBe(2);
  });

  it("counts a single deletion", () => {
    expect(editDistance("python", "pythn")).toBe(1);
  });

  it("handles an empty side", () => {
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });
});

describe("findCloseMatch", () => {
  const corpus = buildSkillCorpus([
    job("PostgreSQL", "JavaScript", "TypeScript", "Go"),
  ]);

  it("corrects a one-character typo", () => {
    expect(findCloseMatch("PostegreSQL", corpus)).toBe("PostgreSQL");
  });

  it("returns null for an exact match, since there is nothing to correct", () => {
    expect(findCloseMatch("postgresql", corpus)).toBeNull();
  });

  it("returns null for something genuinely unrelated", () => {
    expect(findCloseMatch("Kubernetes", corpus)).toBeNull();
  });

  it("will not correct a very short word, where one edit changes the meaning", () => {
    // "Go" -> "No" is one edit but obviously not a typo for the same thing.
    expect(findCloseMatch("No", corpus)).toBeNull();
  });

  it("prefers the closest candidate", () => {
    const c = buildSkillCorpus([job("Java", "JavaScript")]);
    expect(findCloseMatch("Javas", c)).toBe("Java");
  });

  it("is null against an empty corpus", () => {
    expect(findCloseMatch("react", [])).toBeNull();
  });
});

describe("classifySkills", () => {
  const corpus = buildSkillCorpus([job("React", "PostgreSQL", "TypeScript")]);

  it("recognises a skill employers actually ask for", () => {
    const result = classifySkills(["react"], corpus);
    expect(result.matched).toEqual(["react"]);
    expect(result.unmatched).toEqual([]);
  });

  it("flags a skill no job asks for", () => {
    const result = classifySkills(["AI Orientation"], corpus);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([
      { skill: "AI Orientation", suggestion: null },
    ]);
  });

  it("offers a correction for a near miss", () => {
    const result = classifySkills(["PostegreSQL"], corpus);
    expect(result.unmatched).toEqual([
      { skill: "PostegreSQL", suggestion: "PostgreSQL" },
    ]);
  });

  it("keeps the seeker's own spelling in the matched list", () => {
    // Free text stays free: we report, we do not rewrite what they typed.
    expect(classifySkills(["REACT"], corpus).matched).toEqual(["REACT"]);
  });

  it("ignores blank entries", () => {
    const result = classifySkills(["", "   ", "react"], corpus);
    expect(result.matched).toEqual(["react"]);
    expect(result.unmatched).toEqual([]);
  });

  it("treats everything as unmatched when the corpus is empty", () => {
    // A brand-new board has no tags yet; that must not accuse every skill.
    const result = classifySkills(["react"], []);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([{ skill: "react", suggestion: null }]);
  });
});
