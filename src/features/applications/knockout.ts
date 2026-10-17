import type { JobApplicationQuestion } from "@/features/jobs/types";

/**
 * Screening gates.
 *
 * A recruiter can mark one answer to a yes/no or multiple-choice question as
 * required — "do you have the right to work here", "are you able to be in the
 * office two days a week". An applicant who does not match is told at the
 * point of applying instead of waiting weeks for a rejection that was
 * mechanical from the start. That is as much a candidate feature as a
 * recruiter one.
 *
 * Only questions whose answers are drawn from a fixed set can be gated. Free
 * text is never gated: there is no honest way to decide mechanically whether
 * a sentence matches, and a false rejection here costs someone a job.
 */

const GATEABLE_TYPES: readonly JobApplicationQuestion["type"][] = [
  "yes_no",
  "multiple_choice",
];

export function isGateable(question: JobApplicationQuestion): boolean {
  return GATEABLE_TYPES.includes(question.type);
}

/** Is this question configured as a gate at all? */
function gateValue(question: JobApplicationQuestion): string | null {
  if (!isGateable(question)) return null;
  const value = question.knockoutAnswer?.trim();
  return value ? value : null;
}

function normalise(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value ?? "").trim().toLowerCase();
}

/**
 * The first gate the given answers fail, or null if they pass them all.
 *
 * A missing answer to a gated question fails it: "no answer" cannot be
 * treated as a match, or leaving the field blank would become the way past
 * every gate.
 */
export function findKnockout(
  questions: JobApplicationQuestion[],
  answers: Record<string, unknown>,
): JobApplicationQuestion | null {
  for (const question of questions) {
    const required = gateValue(question);
    if (!required) continue;
    if (!(question.id in answers)) return question;
    if (normalise(answers[question.id]) !== normalise(required)) return question;
  }
  return null;
}

/** How the gate reads to the recruiter configuring it, or null if not a gate. */
export function knockoutLabel(
  question: JobApplicationQuestion,
): string | null {
  const required = gateValue(question);
  if (!required) return null;
  if (question.type === "yes_no") {
    return normalise(required) === "yes" ? "Must answer Yes" : "Must answer No";
  }
  return `Must answer “${required}”`;
}
