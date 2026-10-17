import { z } from "zod";

import type { JobApplicationQuestion } from "@/features/jobs/types";

/** One answer as the apply form holds it: text, a chosen option, or yes/no. */
export type AnswerValue = string | boolean;

/** Text-length ceilings, shared by the form fields and the server check. */
export const ANSWER_MAX_LENGTH = { short_text: 300, long_text: 2000 } as const;

/** An untouched select or text box submits "", which means "no answer". */
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

function fieldSchemaFor(question: JobApplicationQuestion): z.ZodTypeAny {
  if (question.type === "yes_no") {
    const base = z.boolean({ error: "Choose yes or no." });
    return question.required ? base : base.optional();
  }
  if (question.type === "multiple_choice") {
    const options = question.options.length > 0 ? question.options : ["__none__"];
    const base = z.enum(options as [string, ...string[]], { error: "Choose one of the options." });
    return z.preprocess(blankToUndefined, question.required ? base : base.optional());
  }
  const maxLength = ANSWER_MAX_LENGTH[question.type];
  const base = z.string().trim().max(maxLength);
  return question.required
    ? base.min(1, "This question is required.")
    : base.optional();
}

/**
 * Builds a Zod object schema validating a seeker's answers to one job's
 * custom application questions, keyed by question id — e.g. `{ q1: "Yes" }`.
 */
export function buildAnswersSchema(
  questions: JobApplicationQuestion[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const question of questions) shape[question.id] = fieldSchemaFor(question);
  return z.object(shape);
}

/**
 * Where the apply form starts. Yes/no and multiple choice begin unanswered:
 * a pre-selected "No" on a screening question turned away anyone who did not
 * notice it, before they had answered anything at all.
 */
export function initialAnswers(questions: JobApplicationQuestion[]): Record<string, AnswerValue> {
  return Object.fromEntries(
    questions
      .filter((q) => q.type === "short_text" || q.type === "long_text")
      .map((q) => [q.id, ""]),
  );
}

export interface AnswerSnapshot {
  questionId: string;
  label: string;
  type: JobApplicationQuestion["type"];
  /** "" when the question was left unanswered. */
  answer: AnswerValue;
}

/**
 * The answers as they were when the application was sent, labels included, so
 * the recruiter reads exactly what was asked even if the job is edited later.
 * A skipped question is stored as "" — never as `false`, which would put a
 * "No" in the recruiter's view that the candidate never gave.
 */
export function snapshotAnswers(
  questions: JobApplicationQuestion[],
  answers: Record<string, unknown>,
): AnswerSnapshot[] {
  return questions.map((q) => {
    const given = answers[q.id];
    return {
      questionId: q.id,
      label: q.label,
      type: q.type,
      answer: typeof given === "boolean" ? given : String(given ?? ""),
    };
  });
}

/** How a stored answer reads to the recruiter. */
export function answerLabel(answer: AnswerValue): string {
  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  return answer || "—";
}
