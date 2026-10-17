import { normaliseSkill } from "@/features/matching/applicant-match";

/**
 * Which skills a seeker is missing most often, across the jobs they have
 * shown interest in.
 *
 * This is the counterpart to the recruiter's match score, pointed the other
 * way: instead of telling an employer how well someone fits, it tells the
 * candidate what to learn next. "Across the twelve roles you saved, nine
 * asked for Docker and you have not listed it" is far more useful than a
 * score, and it is the retention hook for an early-career audience — the
 * product has a reason to be opened again next week.
 *
 * Pure, and derived entirely from data already loaded: the tags on jobs the
 * seeker saved or applied to, and the skills on their own profile.
 */

/** Short enough to act on. A list of thirty is a wall, not advice. */
const DEFAULT_LIMIT = 8;

export interface SkillGap {
  /** The spelling to show — the most common one across the jobs. */
  label: string;
  /** How many of the seeker's jobs ask for it. */
  jobCount: number;
  /** Share of those jobs, 0–100. */
  share: number;
}

export function aggregateSkillGaps(
  jobs: { tags: string[] }[],
  seekerSkills: string[],
  limit: number = DEFAULT_LIMIT,
): SkillGap[] {
  if (jobs.length === 0) return [];

  const owned = new Set(seekerSkills.map(normaliseSkill).filter(Boolean));

  interface Tally {
    key: string;
    jobCount: number;
    /** Spelling → times seen, so the label can be the commonest one. */
    spellings: Map<string, number>;
    /** Index of the first job that mentioned it, for stable tie-breaks. */
    firstSeen: number;
  }
  const tallies = new Map<string, Tally>();

  jobs.forEach((job, jobIndex) => {
    // Per job, not per tag: a job repeating a skill must not count twice.
    const seenInJob = new Set<string>();
    for (const tag of job.tags) {
      const key = normaliseSkill(tag);
      if (!key || owned.has(key) || seenInJob.has(key)) continue;
      seenInJob.add(key);

      const existing = tallies.get(key);
      if (existing) {
        existing.jobCount += 1;
        existing.spellings.set(tag, (existing.spellings.get(tag) ?? 0) + 1);
      } else {
        tallies.set(key, {
          key,
          jobCount: 1,
          spellings: new Map([[tag, 1]]),
          firstSeen: jobIndex,
        });
      }
    }
  });

  return [...tallies.values()]
    .sort((a, b) => {
      if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
      // Alphabetical on the comparison key, so the order never depends on
      // insertion and the same inputs always render the same list.
      return a.key.localeCompare(b.key);
    })
    .slice(0, limit)
    .map((tally) => ({
      label: pickLabel(tally.spellings),
      jobCount: tally.jobCount,
      share: Math.round((tally.jobCount / jobs.length) * 100),
    }));
}

/**
 * The commonest spelling wins; a tie keeps whichever was inserted first,
 * which is the first job that mentioned it. Map iteration order is insertion
 * order, so this is deterministic.
 */
function pickLabel(spellings: Map<string, number>): string {
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
