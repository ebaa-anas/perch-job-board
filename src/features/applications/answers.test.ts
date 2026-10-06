import { describe, expect, it } from "vitest";

import type { JobApplicationQuestion } from "@/features/jobs/types";
import { buildAnswersSchema } from "@/features/applications/answers";

function question(overrides: Partial<JobApplicationQuestion>): JobApplicationQuestion {
  return {
    id: "q1",
    label: "Question",
    type: "short_text",
    required: true,
    options: [],
    ...overrides,
  };
}

describe("buildAnswersSchema", () => {
  it("accepts an empty schema for a job with no questions", () => {
    const schema = buildAnswersSchema([]);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("requires a non-empty value for a required short_text question", () => {
    const schema = buildAnswersSchema([question({ id: "q1", type: "short_text" })]);
    expect(schema.safeParse({ q1: "" }).success).toBe(false);
    expect(schema.safeParse({ q1: "Two weeks" }).success).toBe(true);
  });

  it("allows an optional short_text question to be omitted", () => {
    const schema = buildAnswersSchema([
      question({ id: "q1", type: "short_text", required: false }),
    ]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ q1: "" }).success).toBe(true);
  });

  it("validates a required yes_no question as a boolean", () => {
    const schema = buildAnswersSchema([question({ id: "q1", type: "yes_no" })]);
    expect(schema.safeParse({ q1: true }).success).toBe(true);
    expect(schema.safeParse({ q1: "true" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("restricts a multiple_choice answer to the defined options", () => {
    const schema = buildAnswersSchema([
      question({ id: "q1", type: "multiple_choice", options: ["Yes", "No"] }),
    ]);
    expect(schema.safeParse({ q1: "Yes" }).success).toBe(true);
    expect(schema.safeParse({ q1: "Maybe" }).success).toBe(false);
  });

  it("validates each question independently by id", () => {
    const schema = buildAnswersSchema([
      question({ id: "q1", type: "short_text", required: true }),
      question({ id: "q2", type: "yes_no", required: false }),
    ]);
    const result = schema.safeParse({ q1: "hi" });
    expect(result.success).toBe(true);
  });
});
