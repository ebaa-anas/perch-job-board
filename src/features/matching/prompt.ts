import type { ExperienceLevel, JobType } from "@/features/jobs/types";

/**
 * The exact JSON shape the model must return — kept in one place so the
 * system prompt and `fitAssessmentSchema` (schema.ts) can't drift apart.
 */
export const FIT_SCORE_SYSTEM_PROMPT = `You are a hiring-fit assistant for a job board aimed at entry-level and early-career candidates. Given a candidate profile and a job, assess how good a fit the candidate is.

Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly this shape:
{
  "score": <integer 0-100>,
  "summary": "<one sentence, plain language, max 200 characters>",
  "strengths": ["<short phrase>", ... up to 4],
  "gaps": ["<short phrase>", ... up to 4]
}

Be encouraging but honest. A missing skill is a "gap", not a disqualifier. If the candidate profile is thin, still give your best estimate from what's there.`;

interface FitProfileInput {
  headline: string | null;
  bio: string | null;
  skills: string[];
}

interface FitJobInput {
  title: string;
  description: string;
  requirements: string[];
  tags: string[];
  experience: ExperienceLevel;
  type: JobType;
}

/**
 * Deterministic JSON fingerprint of a (profile, job) pair — sent to the model
 * as the user message AND hashed to key the fit-score cache, so a cache hit
 * exactly reflects what would be sent if it missed.
 */
export function buildFitScoreInput(profile: FitProfileInput, job: FitJobInput): string {
  return JSON.stringify({
    candidate: {
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      skills: [...profile.skills].sort(),
    },
    job: {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      tags: [...job.tags].sort(),
      experience: job.experience,
      type: job.type,
    },
  });
}

/** Strips an optional ```/```json code fence and surrounding whitespace. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}
