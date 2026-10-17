import type { BadgeTone } from "@/components/ui/badge";

/**
 * The recruiter-facing hiring pipeline.
 *
 * A submitted `applications` row is immutable by design (see migration 0005 —
 * recruiters must download exactly what was sent), so stage lives in its own
 * table, `application_pipeline`, with the transition history appended to
 * `application_events`. Everything in this module is pure so the state machine
 * can be tested without a database.
 */

export const APPLICATION_STAGES = [
  "applied",
  "reviewed",
  "shortlisted",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const DEFAULT_STAGE: ApplicationStage = "applied";

/** Once hired, the pipeline is closed; a rejection can still be reopened. */
const TERMINAL_STAGES: readonly ApplicationStage[] = ["hired", "rejected"];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: "Applied",
  reviewed: "In review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
};

export const STAGE_TONES: Record<ApplicationStage, BadgeTone> = {
  applied: "neutral",
  reviewed: "info",
  shortlisted: "info",
  interview: "primary",
  offer: "warning",
  hired: "success",
  rejected: "outline",
};

export function isApplicationStage(value: unknown): value is ApplicationStage {
  return (
    typeof value === "string" &&
    (APPLICATION_STAGES as readonly string[]).includes(value)
  );
}

export function isTerminalStage(stage: ApplicationStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/**
 * Has a human acted on this application? This is the number the whole
 * "application black hole" problem is measured by, so it counts a rejection as
 * a response — silence is the only failure.
 */
export function isDecided(stage: ApplicationStage): boolean {
  return stage !== "applied";
}

export function canTransition(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  // `hired` is the one write-once outcome: reopening it would desync whatever
  // the recruiter did outside the product (contract signed, seat filled).
  if (from === "hired") return false;
  return true;
}

export function nextStages(from: ApplicationStage): ApplicationStage[] {
  return APPLICATION_STAGES.filter((stage) => canTransition(from, stage));
}

/* -------------------------------------------------------------------------- */
/*  Candidate-facing status                                                    */
/* -------------------------------------------------------------------------- */

export const SEEKER_STATUSES = [
  "submitted",
  "in_review",
  "interview",
  "offer",
  "hired",
  "not_selected",
] as const;
export type SeekerStatus = (typeof SEEKER_STATUSES)[number];

/**
 * Internal stage → what the candidate is told.
 *
 * Deliberately lossy: `shortlisted` collapses into `in_review` so recruiters
 * keep private triage granularity and candidates are never told they are a
 * frontrunner before anyone has committed to that. Everything the candidate is
 * genuinely party to — interview, offer, the outcome — is shown as-is.
 */
const SEEKER_STATUS_BY_STAGE: Record<ApplicationStage, SeekerStatus> = {
  applied: "submitted",
  reviewed: "in_review",
  shortlisted: "in_review",
  interview: "interview",
  offer: "offer",
  hired: "hired",
  rejected: "not_selected",
};

export function seekerStatusFor(stage: ApplicationStage): SeekerStatus {
  return SEEKER_STATUS_BY_STAGE[stage];
}

export const SEEKER_STATUS_LABELS: Record<SeekerStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  not_selected: "Not selected",
};

export const SEEKER_STATUS_TONES: Record<SeekerStatus, BadgeTone> = {
  submitted: "neutral",
  in_review: "info",
  interview: "primary",
  offer: "warning",
  hired: "success",
  not_selected: "outline",
};

/* -------------------------------------------------------------------------- */
/*  Employer responsiveness                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Share of applications a company has actually responded to, 0–100, or `null`
 * when there is nothing to judge yet. Surfaced publicly on company profiles:
 * it is the one metric that makes ghosting visible, and the flywheel that
 * pushes employers to use the pipeline at all.
 */
export function computeResponseRate(stages: ApplicationStage[]): number | null {
  if (stages.length === 0) return null;
  const responded = stages.filter(isDecided).length;
  return Math.round((responded / stages.length) * 100);
}
