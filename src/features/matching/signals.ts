import type { ExperienceLevel } from "@/features/jobs/types";

/**
 * Comparisons between a job and a seeker on the axes added in 0022.
 *
 * Deliberately kept out of the skills percentage. That number answers one
 * narrow question — what share of the requested skills this person lists —
 * and folding unlike things into it is what makes a score unexplainable.
 * These come back as separate, named facts instead.
 *
 * The governing rule: **a value the seeker has not given is never compared.**
 * Silence is not a mismatch. Treating a blank as "no" would quietly rank
 * every incomplete profile below every complete one, and on an early-career
 * board the incomplete profiles belong to the people with least practice at
 * filling them in.
 */

export type SignalTone = "match" | "differs" | "blocker";

export type SignalId = "experience" | "entryLevel" | "sponsorship";

export interface MatchSignal {
  id: SignalId;
  tone: SignalTone;
}

export interface JobSignalInput {
  experience: ExperienceLevel;
  visaSponsorship: boolean;
  noExperienceRequired: boolean;
}

export interface SeekerSignalInput {
  experience: ExperienceLevel | null;
  noProfessionalExperience: boolean | null;
  needsVisaSponsorship: boolean | null;
}

export function matchSignals(
  job: JobSignalInput,
  seeker: SeekerSignalInput,
): MatchSignal[] {
  const signals: MatchSignal[] = [];

  // Experience — only when the seeker has stated one.
  if (seeker.experience !== null) {
    signals.push({
      id: "experience",
      // "differs", not "below"/"unqualified": a lead applying to a mid role is
      // a deliberate choice as often as a mismatch, and the product has no
      // business calling it a failure.
      tone: seeker.experience === job.experience ? "match" : "differs",
    });
  }

  // The entry-level pairing this board exists for.
  if (seeker.noProfessionalExperience === true && job.noExperienceRequired) {
    signals.push({ id: "entryLevel", tone: "match" });
  }

  // Sponsorship is only ever worth saying when the seeker needs it. For
  // everyone else a job not offering it is unremarkable, and saying so would
  // turn the common case into noise.
  if (seeker.needsVisaSponsorship === true) {
    signals.push({
      id: "sponsorship",
      tone: job.visaSponsorship ? "match" : "blocker",
    });
  }

  return signals;
}
