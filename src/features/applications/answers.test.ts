import { describe, expect, it } from "vitest";

import type { JobApplicationQuestion } from "@/features/jobs/types";
import {
  answerLabel,
  buildAnswersSchema,
  initialAnswers,
  snapshotAnswers,
} from "@/features/applications/answers";

function question(overrides: Partial<JobApplicationQuestion>): JobApplicationQuestion {
  return {
    id: "q1",
    label: "Question",
    type: "short_text",
    required: true,
    options: [],
    knockoutAnswer: null,
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

function firstMessage(questions: JobApplicationQuestion[], answers: Record<string, unknown>) {
  const result = buildAnswersSchema(questions).safeParse(answers);
  return result.success ? null : result.error.issues[0]?.message;
}

describe("buildAnswersSchema — unanswered questions", () => {
  it("asks for an answer when a required text question is left empty", () => {
    expect(firstMessage([question({ type: "short_text" })], { q1: "  " })).toBe(
      "This question is required.",
    );
  });

  it("asks for a choice when a required yes/no is left unanswered", () => {
    expect(firstMessage([question({ type: "yes_no" })], {})).toBe("Choose yes or no.");
  });

  it("asks for a choice when a required multiple choice is left on its placeholder", () => {
    const form = [question({ type: "multiple_choice", options: ["A", "B"] })];
    expect(firstMessage(form, { q1: "" })).toBe("Choose one of the options.");
    expect(firstMessage(form, {})).toBe("Choose one of the options.");
  });

  it("lets an optional multiple choice be left on its placeholder", () => {
    const schema = buildAnswersSchema([
      question({ type: "multiple_choice", options: ["A", "B"], required: false }),
    ]);
    expect(schema.safeParse({ q1: "" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("initialAnswers", () => {
  it("starts yes/no and multiple choice unanswered, text fields empty", () => {
    const answers = initialAnswers([
      question({ id: "gate", type: "yes_no" }),
      question({ id: "pick", type: "multiple_choice", options: ["A", "B"] }),
      question({ id: "short", type: "short_text" }),
      question({ id: "long", type: "long_text" }),
    ]);
    expect(answers).toEqual({ short: "", long: "" });
  });
});

describe("snapshotAnswers", () => {
  const form = [
    question({ id: "gate", label: "Office two days a week?", type: "yes_no" }),
    question({ id: "extra", label: "Happy to travel?", type: "yes_no", required: false }),
    question({ id: "pick", label: "Level", type: "multiple_choice", options: ["A", "B"], required: false }),
  ];

  it("keeps the answers that were given", () => {
    const [gate] = snapshotAnswers(form, { gate: false, pick: "A" });
    expect(gate).toEqual({ questionId: "gate", label: "Office two days a week?", type: "yes_no", answer: false });
  });

  it("records a skipped question as unanswered, never as No", () => {
    const [, extra, pick] = snapshotAnswers(form, { gate: true });
    expect(extra.answer).toBe("");
    expect(pick.answer).toBe("");
  });
});

describe("answerLabel", () => {
  it("shows yes/no answers as words and a skipped answer as a dash", () => {
    expect(answerLabel(true)).toBe("Yes");
    expect(answerLabel(false)).toBe("No");
    expect(answerLabel("")).toBe("—");
    expect(answerLabel("Research")).toBe("Research");
  });
});
