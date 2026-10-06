import { z } from "zod";

import type { JobApplicationQuestion } from "@/features/jobs/types";

function fieldSchemaFor(question: JobApplicationQuestion): z.ZodTypeAny {
  if (question.type === "yes_no") {
    const base = z.boolean();
    return question.required ? base : base.optional();
  }
  if (question.type === "multiple_choice") {
    const options = question.options.length > 0 ? question.options : ["__none__"];
    const base = z.enum(options as [string, ...string[]]);
    return question.required ? base : base.optional();
  }
  const maxLength = question.type === "long_text" ? 2000 : 300;
  const base = z.string().trim().max(maxLength);
  return question.required
    ? base.min(1, "This question is required")
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
