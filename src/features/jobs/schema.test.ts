import { describe, expect, it } from "vitest";

import {
  applicationQuestionSchema,
  applicationQuestionsSchema,
  jobEditorApiSchema,
  jobEditorSchema,
  linesToList,
  tokensToList,
} from "@/features/jobs/schema";

const VALID_API_INPUT = {
  title: "Frontend Engineer",
  location: "Remote",
  type: "full-time" as const,
  workMode: "remote" as const,
  experience: "mid" as const,
  salaryMin: 60000,
  salaryMax: 90000,
  description: "x".repeat(60),
  responsibilities: ["Ship features"],
  requirements: ["3+ years experience"],
  perks: [],
  tags: ["React"],
};

describe("jobEditorApiSchema", () => {
  it("accepts a fully valid job", () => {
    expect(jobEditorApiSchema.safeParse(VALID_API_INPUT).success).toBe(true);
  });

  it("rejects a title under 3 characters", () => {
    const result = jobEditorApiSchema.safeParse({ ...VALID_API_INPUT, title: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects a description under 50 characters", () => {
    const result = jobEditorApiSchema.safeParse({
      ...VALID_API_INPUT,
      description: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects salaryMax below salaryMin", () => {
    const result = jobEditorApiSchema.safeParse({
      ...VALID_API_INPUT,
      salaryMin: 100,
      salaryMax: 50,
    });
    expect(result.success).toBe(false);
  });

  it("accepts salaryMax equal to salaryMin", () => {
    const result = jobEditorApiSchema.safeParse({
      ...VALID_API_INPUT,
      salaryMin: 100,
      salaryMax: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a salary above the ceiling", () => {
    const result = jobEditorApiSchema.safeParse({
      ...VALID_API_INPUT,
      salaryMax: 10_000_001,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown job type", () => {
    const result = jobEditorApiSchema.safeParse({ ...VALID_API_INPUT, type: "freelance" });
    expect(result.success).toBe(false);
  });

  it("defaults questions to an empty array", () => {
    expect(jobEditorApiSchema.parse(VALID_API_INPUT).questions).toEqual([]);
  });

  it("defaults noExperienceRequired and visaSponsorship to false", () => {
    const result = jobEditorApiSchema.parse(VALID_API_INPUT);
    expect(result.noExperienceRequired).toBe(false);
    expect(result.visaSponsorship).toBe(false);
  });

  it("accepts explicit noExperienceRequired and visaSponsorship", () => {
    const result = jobEditorApiSchema.parse({
      ...VALID_API_INPUT,
      noExperienceRequired: true,
      visaSponsorship: true,
    });
    expect(result.noExperienceRequired).toBe(true);
    expect(result.visaSponsorship).toBe(true);
  });

  it("defaults language to 'en' and accepts 'tr'", () => {
    expect(jobEditorApiSchema.parse(VALID_API_INPUT).language).toBe("en");
    expect(jobEditorApiSchema.parse({ ...VALID_API_INPUT, language: "tr" }).language).toBe(
      "tr",
    );
  });

  it("rejects an unknown language", () => {
    expect(
      jobEditorApiSchema.safeParse({ ...VALID_API_INPUT, language: "fr" }).success,
    ).toBe(false);
  });
});

describe("jobEditorSchema (client form shape)", () => {
  it("accepts raw textarea/comma strings and the niche flag booleans", () => {
    const result = jobEditorSchema.parse({
      title: "Frontend Engineer",
      location: "Remote",
      type: "full-time",
      workMode: "remote",
      experience: "mid",
      salaryMin: 60000,
      salaryMax: 90000,
      description: "x".repeat(60),
      responsibilities: "Ship features",
      requirements: "3+ years experience",
      perks: "",
      tags: "React",
      noExperienceRequired: false,
      visaSponsorship: true,
      language: "tr",
      questions: [],
    });
    expect(result.noExperienceRequired).toBe(false);
    expect(result.visaSponsorship).toBe(true);
    expect(result.language).toBe("tr");
  });
});

describe("applicationQuestionSchema", () => {
  const SHORT_TEXT = { label: "What's your notice period?", type: "short_text" as const, required: true, options: [] };

  it("accepts a valid short-text question", () => {
    expect(applicationQuestionSchema.safeParse(SHORT_TEXT).success).toBe(true);
  });

  it("rejects a label under 3 characters", () => {
    expect(
      applicationQuestionSchema.safeParse({ ...SHORT_TEXT, label: "Hi" }).success,
    ).toBe(false);
  });

  it("rejects an unknown question type", () => {
    expect(
      applicationQuestionSchema.safeParse({ ...SHORT_TEXT, type: "essay" }).success,
    ).toBe(false);
  });

  it("requires at least 2 options for a multiple_choice question", () => {
    expect(
      applicationQuestionSchema.safeParse({
        ...SHORT_TEXT,
        type: "multiple_choice",
        options: ["Only one"],
      }).success,
    ).toBe(false);
    expect(
      applicationQuestionSchema.safeParse({
        ...SHORT_TEXT,
        type: "multiple_choice",
        options: ["One", "Two"],
      }).success,
    ).toBe(true);
  });

  it("doesn't require options for non-choice types", () => {
    expect(
      applicationQuestionSchema.safeParse({ ...SHORT_TEXT, type: "yes_no", options: [] })
        .success,
    ).toBe(true);
  });
});

describe("applicationQuestionsSchema", () => {
  const question = (label: string) => ({
    label,
    type: "short_text" as const,
    required: false,
    options: [],
  });

  it("accepts up to the maximum number of questions", () => {
    const six = Array.from({ length: 6 }, (_, i) => question(`Question ${i}`));
    expect(applicationQuestionsSchema.safeParse(six).success).toBe(true);
  });

  it("rejects more than the maximum number of questions", () => {
    const seven = Array.from({ length: 7 }, (_, i) => question(`Question ${i}`));
    expect(applicationQuestionsSchema.safeParse(seven).success).toBe(false);
  });
});

describe("linesToList", () => {
  it("splits on newlines, trims, and drops blank lines", () => {
    expect(linesToList("One\n\nTwo \n Three")).toEqual(["One", "Two", "Three"]);
  });

  it("strips leading bullet/number markers", () => {
    expect(linesToList("- One\n* Two\n1. Three\n2) Four")).toEqual([
      "One",
      "Two",
      "Three",
      "Four",
    ]);
  });

  it("de-dupes identical lines", () => {
    expect(linesToList("React\nReact\nreact")).toEqual(["React", "react"]);
  });
});

describe("tokensToList", () => {
  it("splits on commas and newlines and trims", () => {
    expect(tokensToList("React, TypeScript,\nNode.js")).toEqual([
      "React",
      "TypeScript",
      "Node.js",
    ]);
  });

  it("de-dupes and drops empties", () => {
    expect(tokensToList("React,, React ,")).toEqual(["React"]);
  });
});
