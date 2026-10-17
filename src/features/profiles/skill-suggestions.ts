import { normaliseSkill } from "@/features/matching/applicant-match";

/**
 * Aligning the words candidates use with the words recruiters use.
 *
 * The match score compares a seeker's `skills` against a job's `tags`, but
 * nothing has ever made those two vocabularies agree. A profile reading
 * "OOP, AI Orientation, PostegreSQL" contributes nothing to any match — the
 * first two are real but nobody tags jobs with them, the third is a typo —
 * and the seeker has no way to know.
 *
 * So the suggestions come from the board's own corpus rather than a canned
 * taxonomy: the only skills worth autocompleting are the ones employers here
 * are actually hiring for, and the list stays current by construction.
 *
 * Free text is deliberately still allowed. This reports, it does not rewrite
 * what someone typed about themselves.
 */

export interface SkillSuggestion {
  /** The commonest spelling across jobs — what gets shown. */
  label: string;
  /** How many jobs ask for it. */
  count: number;
}

export function buildSkillCorpus(
  jobs: { tags: string[] }[],
): SkillSuggestion[] {
  interface Tally {
    key: string;
    count: number;
    spellings: Map<string, number>;
  }
  const tallies = new Map<string, Tally>();

  for (const job of jobs) {
    // Per job, not per tag: a job repeating a tag must not count twice.
    const seen = new Set<string>();
    for (const tag of job.tags) {
      const key = normaliseSkill(tag);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const existing = tallies.get(key);
      if (existing) {
        existing.count += 1;
        existing.spellings.set(tag, (existing.spellings.get(tag) ?? 0) + 1);
      } else {
        tallies.set(key, { key, count: 1, spellings: new Map([[tag, 1]]) });
      }
    }
  }

  return [...tallies.values()]
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.key.localeCompare(b.key),
    )
    .map((tally) => ({ label: commonestSpelling(tally.spellings), count: tally.count }));
}

function commonestSpelling(spellings: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/*  Typo correction                                                            */
/* -------------------------------------------------------------------------- */

/** Levenshtein distance, two rows rather than a full matrix. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

/**
 * Minimum length before a correction is offered at all.
 *
 * On a short token one edit is usually a different word, not a typo — "Go"
 * and "No" are one edit apart. Suggesting the wrong correction is worse than
 * suggesting none, because the seeker may accept it.
 */
const MIN_CORRECTABLE_LENGTH = 4;

/** Allowed edits, scaled so longer words tolerate a little more. */
function budgetFor(length: number): number {
  return length >= 8 ? 2 : 1;
}

/**
 * The closest corpus entry to `input`, or null when nothing is close enough
 * — including when `input` already matches exactly, where there is nothing
 * to correct.
 */
export function findCloseMatch(
  input: string,
  corpus: SkillSuggestion[],
): string | null {
  const key = normaliseSkill(input);
  if (!key || key.length < MIN_CORRECTABLE_LENGTH) return null;

  const budget = budgetFor(key.length);
  let best: { label: string; distance: number } | null = null;

  for (const entry of corpus) {
    const candidate = normaliseSkill(entry.label);
    if (!candidate) continue;
    if (candidate === key) return null; // exact — nothing to suggest
    // Length alone can rule a candidate out before the expensive compare.
    if (Math.abs(candidate.length - key.length) > budget) continue;

    const distance = editDistance(key, candidate);
    if (distance <= budget && (!best || distance < best.distance)) {
      best = { label: entry.label, distance };
    }
  }

  return best?.label ?? null;
}

/* -------------------------------------------------------------------------- */

export interface SkillClassification {
  /** Skills that match a tag some job on the board uses. */
  matched: string[];
  /** Skills no job asks for, with a correction when one looks likely. */
  unmatched: { skill: string; suggestion: string | null }[];
}

/**
 * Split what the seeker typed into "employers search for this" and "nobody
 * here asks for this", so the hint can be specific rather than scolding.
 */
export function classifySkills(
  skills: string[],
  corpus: SkillSuggestion[],
): SkillClassification {
  const known = new Set(
    corpus.map((entry) => normaliseSkill(entry.label)).filter(Boolean),
  );

  const matched: string[] = [];
  const unmatched: { skill: string; suggestion: string | null }[] = [];

  for (const skill of skills) {
    const key = normaliseSkill(skill);
    if (!key) continue;
    if (known.has(key)) matched.push(skill);
    else unmatched.push({ skill, suggestion: findCloseMatch(skill, corpus) });
  }

  return { matched, unmatched };
}
