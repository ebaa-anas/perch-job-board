/**
 * Inclusive-language linter for job descriptions.
 *
 * A word list, not a model, and that is a deliberate choice: the recruiter
 * needs to know *which* phrase to change and why, a fixed list gives the same
 * answer every time, it costs nothing to run on every keystroke, and nobody
 * has to send an unpublished job posting to a third party to get advice on it.
 *
 * Framed as advice throughout. Nothing here blocks publishing — the wording
 * belongs to the employer, and a linter that refused to let people write would
 * simply be switched off.
 *
 * The evidence for the gendered and culture-coded entries is well established:
 * masculine-coded wording measurably reduces applications from women, and
 * age-coded phrasing is a discrimination exposure in most of the markets this
 * board serves.
 */

export type LintCategory = "gendered" | "age" | "ableist" | "jargon";

export interface LintFinding {
  /** The phrase as the list defines it, lowercased. */
  term: string;
  category: LintCategory;
  suggestion: string;
  /** How many times it appears. */
  occurrences: number;
  /** Character index of the first occurrence, for ordering. */
  at: number;
}

interface Entry {
  term: string;
  category: LintCategory;
  suggestion: string;
}

const ENTRIES: Entry[] = [
  // Gendered ---------------------------------------------------------------
  { term: "salesman", category: "gendered", suggestion: "salesperson" },
  { term: "salesmen", category: "gendered", suggestion: "salespeople" },
  { term: "chairman", category: "gendered", suggestion: "chair, or chairperson" },
  { term: "manpower", category: "gendered", suggestion: "workforce, or staffing" },
  { term: "he or she", category: "gendered", suggestion: "they" },
  { term: "his or her", category: "gendered", suggestion: "their" },
  { term: "guys", category: "gendered", suggestion: "the team, or everyone" },
  { term: "manned", category: "gendered", suggestion: "staffed" },
  { term: "aggressive", category: "gendered", suggestion: "proactive, or driven" },
  { term: "dominant", category: "gendered", suggestion: "leading" },

  // Age-coded --------------------------------------------------------------
  { term: "young", category: "age", suggestion: "early-career, if that is what you mean" },
  { term: "youthful", category: "age", suggestion: "energetic, or simply drop it" },
  { term: "digital native", category: "age", suggestion: "comfortable with modern tools" },
  { term: "recent graduate", category: "age", suggestion: "open to candidates at any stage" },
  { term: "mature", category: "age", suggestion: "experienced" },

  // Ableist / unnecessary physical requirements ----------------------------
  {
    term: "able to stand",
    category: "ableist",
    suggestion: "state the task, not the posture, and note if it is negotiable",
  },
  {
    term: "stand for long periods",
    category: "ableist",
    suggestion: "describe the actual work, and whether adjustments are available",
  },
  { term: "able-bodied", category: "ableist", suggestion: "drop it, or state the real requirement" },
  { term: "walk and talk", category: "ableist", suggestion: "communicate clearly" },
  { term: "crazy", category: "ableist", suggestion: "intense, or unusual" },
  { term: "insane", category: "ableist", suggestion: "demanding" },

  // Culture-coded jargon that narrows the pool -----------------------------
  { term: "rockstar", category: "jargon", suggestion: "skilled, or experienced" },
  { term: "ninja", category: "jargon", suggestion: "specialist, or expert" },
  { term: "guru", category: "jargon", suggestion: "expert" },
  { term: "wizard", category: "jargon", suggestion: "expert" },
  { term: "superstar", category: "jargon", suggestion: "strong, or accomplished" },
  {
    term: "culture fit",
    category: "jargon",
    suggestion: "name the values or ways of working you mean",
  },
  { term: "work hard play hard", category: "jargon", suggestion: "describe the actual culture" },
  { term: "crush it", category: "jargon", suggestion: "deliver strong results" },
  { term: "hustle", category: "jargon", suggestion: "initiative" },
  { term: "whatever it takes", category: "jargon", suggestion: "describe the real expectations" },
];

/** Escapes regex metacharacters so a term is matched literally. */
function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary matcher.
 *
 * `\b` on both ends is what keeps `chairmanship` from matching `chairman` and
 * `hemanager` from matching `he` — substring matching would make the linter
 * untrustworthy within a sentence or two, and a noisy linter gets ignored.
 */
function patternFor(term: string): RegExp {
  return new RegExp(`\\b${escape(term).replace(/\s+/g, "\\s+")}\\b`, "gi");
}

export function lintInclusiveLanguage(text: string): LintFinding[] {
  if (!text.trim()) return [];

  const findings: LintFinding[] = [];

  for (const entry of ENTRIES) {
    const matches = [...text.matchAll(patternFor(entry.term))];
    if (matches.length === 0) continue;
    findings.push({
      term: entry.term,
      category: entry.category,
      suggestion: entry.suggestion,
      occurrences: matches.length,
      at: matches[0].index ?? 0,
    });
  }

  // Ordered as they appear, so a recruiter reading their own posting top to
  // bottom meets the notes in the same order as the words.
  return findings.sort((a, b) => a.at - b.at);
}

export const LINT_CATEGORY_LABELS: Record<LintCategory, string> = {
  gendered: "Gendered wording",
  age: "Age-coded wording",
  ableist: "Physical requirement",
  jargon: "Jargon",
};
