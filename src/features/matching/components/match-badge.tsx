import { Badge } from "@/components/ui/badge";
import type { ApplicantMatch } from "@/features/matching/applicant-match";

/**
 * The skills-match figure, shown to recruiters.
 *
 * Always rendered next to the tags it was derived from (see `MatchDetail`), so
 * the number is never the whole story a recruiter sees. A match score that
 * cannot be traced back to named skills is the thing this feature was
 * specifically designed not to be.
 */
export function MatchBadge({ match }: { match: ApplicantMatch | undefined }) {
  if (!match || match.score === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const tone =
    match.score >= 75 ? "success" : match.score >= 40 ? "info" : "outline";

  return (
    <Badge
      tone={tone}
      title={`${match.matched.length} of ${
        match.matched.length + match.missing.length
      } listed skills`}
    >
      {match.score}% skills
    </Badge>
  );
}

/**
 * The breakdown. This is the part that makes the score defensible: every
 * point is attributable to a named tag the candidate either listed or did not.
 */
export function MatchDetail({ match }: { match: ApplicantMatch | undefined }) {
  if (!match || match.score === null) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Skills match · {match.score}%
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Compares the skills on this candidate&apos;s profile with the tags on
        this job. It is not a judgement of the person.
      </p>
      {match.matched.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {match.matched.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
      {match.missing.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {match.missing.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground line-through"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
