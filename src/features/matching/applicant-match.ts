/**
 * Transparent applicant matching.
 *
 * Deliberately *not* an AI ranking. Three reasons, in order of weight:
 *
 *   1. Ranking job applicants algorithmically is treated as high-risk under
 *      the EU AI Act. A score a recruiter cannot explain to a candidate — or
 *      to a regulator — is a liability, and "the model said so" is not an
 *      explanation. Skill overlap is auditable: every point is attributable
 *      to a named tag the candidate either listed or did not.
 *   2. Coverage. `job_fit_scores` only holds rows where a seeker happened to
 *      open a job and trigger a scoring, so an AI-derived ranking would be
 *      missing for most applicants and silently rank them last.
 *   3. Cost and latency. This is free and instant, so it can run on every
 *      applicant in a list rather than behind a button.
 *
 * The score answers one narrow question — what share of the skills this job
 * asked for does this candidate list — and nothing else. CV presence, ratings
 * and stage are shown alongside it rather than folded in, because a single
 * number mixing unlike signals is exactly what stops being explainable.
 */

/**
 * Fold a skill name to a comparison key.
 *
 * Everything but letters and digits is dropped, so `Next.js`, `next js` and
 * `NEXTJS` agree — recruiters and candidates never spell these the same way,
 * and an exact-string match would score a perfectly qualified candidate at
 * zero. Digits survive because they carry meaning (`Vue 3`, `ES2015`).
 */
export function normaliseSkill(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ApplicantMatchInput {
  /** The job's skill tags — the thing being matched against. */
  jobTags: string[];
  /** The candidate's self-listed skills. */
  seekerSkills: string[];
}

export interface ApplicantMatch {
  /**
   * Share of the job's tags the candidate lists, 0–100, or `null` when the
   * job lists no tags at all.
   */
  score: number | null;
  /** Job tags the candidate has, in the job's own spelling and order. */
  matched: string[];
  /** Job tags the candidate does not have, same spelling and order. */
  missing: string[];
}

export function scoreApplicant(input: ApplicantMatchInput): ApplicantMatch {
  const candidate = new Set(
    input.seekerSkills.map(normaliseSkill).filter(Boolean),
  );

  // De-duplicated on the comparison key, but the original spelling is kept —
  // the lists are rendered to a recruiter, so `Next.js` must not come back
  // as `nextjs`.
  const tags: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const label of input.jobTags) {
    const key = normaliseSkill(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push({ key, label });
  }

  // No tags means nothing to match against. Reporting 0 would rank every
  // applicant as a poor fit for an omission the recruiter made.
  if (tags.length === 0) {
    return { score: null, matched: [], missing: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const tag of tags) {
    if (candidate.has(tag.key)) matched.push(tag.label);
    else missing.push(tag.label);
  }

  return {
    score: Math.round((matched.length / tags.length) * 100),
    matched,
    missing,
  };
}

/**
 * Order rows by match score, best first, with unscored rows last.
 *
 * Unscored is not zero: a job with no tags yields `null` for everyone, and
 * sinking those below a genuine 0% would be meaningless. Returns a new array
 * and is stable, so applicants with equal scores keep whatever order the
 * caller established (newest first, as the list is loaded).
 */
export function sortByMatch<T>(
  rows: readonly T[],
  scoreOf: (row: T) => number | null,
): T[] {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const sa = scoreOf(a.row);
      const sb = scoreOf(b.row);
      if (sa === sb) return a.index - b.index;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa;
    })
    .map((entry) => entry.row);
}
