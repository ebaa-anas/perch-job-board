import type { ExperienceLevel } from "@/features/jobs/types";

/**
 * Profile completeness.
 *
 * A meter only earns its place if it names a concrete payoff — "60% complete"
 * is a scold, "add your experience level to appear in more searches" is an
 * instruction. So each item carries an id the UI turns into that sentence, and
 * the list is ordered by how much the field actually changes a seeker's
 * results rather than by how much it fills the bar.
 *
 * Weights reflect matching value, not effort: experience and work
 * authorisation are what recruiters filter on and what the match score reads,
 * so they outrank a bio.
 */

export interface CompletenessInput {
  headline: string | null;
  bio: string | null;
  skills: string[];
  hasCv: boolean;
  experience: ExperienceLevel | null;
  noProfessionalExperience: boolean | null;
  needsVisaSponsorship: boolean | null;
  desiredTypes: string[];
  desiredWorkModes: string[];
}

export type CompletenessId =
  | "headline"
  | "skills"
  | "experience"
  | "workAuthorization"
  | "preferences"
  | "cv"
  | "bio";

export interface CompletenessItem {
  id: CompletenessId;
  weight: number;
}

export interface Completeness {
  percent: number;
  /** Unanswered items, most valuable first. */
  missing: CompletenessItem[];
  /** The single highest-value next step, or null when nothing is left. */
  next: CompletenessItem | null;
}

function filled(value: string | null): boolean {
  return Boolean(value && value.trim());
}

export function computeCompleteness(input: CompletenessInput): Completeness {
  const checks: { id: CompletenessId; weight: number; done: boolean }[] = [
    { id: "headline", weight: 20, done: filled(input.headline) },
    { id: "skills", weight: 20, done: input.skills.length > 0 },
    {
      id: "experience",
      weight: 18,
      // "No professional experience yet" is an answer, not a blank. The
      // early-career wedge depends on it being treated as one.
      done:
        input.experience !== null || input.noProfessionalExperience === true,
    },
    {
      id: "workAuthorization",
      weight: 16,
      // `false` is a real answer here; only null is unanswered.
      done: input.needsVisaSponsorship !== null,
    },
    {
      id: "preferences",
      weight: 12,
      done: input.desiredTypes.length > 0 || input.desiredWorkModes.length > 0,
    },
    { id: "cv", weight: 8, done: input.hasCv },
    { id: "bio", weight: 6, done: filled(input.bio) },
  ];

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks
    .filter((check) => check.done)
    .reduce((sum, check) => sum + check.weight, 0);

  const missing = checks
    .filter((check) => !check.done)
    .sort((a, b) => b.weight - a.weight)
    .map(({ id, weight }) => ({ id, weight }));

  return {
    percent: Math.round((earned / total) * 100),
    missing,
    next: missing[0] ?? null,
  };
}
