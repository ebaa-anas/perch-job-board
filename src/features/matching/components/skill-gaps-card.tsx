import Link from "next/link";
import { Target } from "lucide-react";

import type { SkillGap } from "@/features/matching/skill-gaps";

/**
 * "What to learn next", derived from the roles the seeker actually wants.
 *
 * Framed as the market's ask rather than the candidate's deficiency — the
 * share is the honest, checkable fact ("7 of 9 roles asked for this"), and it
 * is the number that makes the advice worth acting on.
 */
export function SkillGapsCard({
  gaps,
  jobCount,
}: {
  gaps: SkillGap[];
  jobCount: number;
}) {
  if (gaps.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Target className="size-5 text-primary" aria-hidden />
        Skills worth adding
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Asked for by the {jobCount} {jobCount === 1 ? "role" : "roles"} you have
        saved or applied to, and not yet on your profile.
      </p>

      <ul className="mt-4 space-y-2">
        {gaps.map((gap) => (
          <li key={gap.label} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {gap.label}
            </span>
            <span
              aria-hidden
              className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${gap.share}%` }}
              />
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {gap.jobCount} of {jobCount}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Already have one of these?{" "}
        <Link href="/profile" className="text-primary hover:underline">
          Add it to your profile
        </Link>{" "}
        so employers can see it.
      </p>
    </section>
  );
}
