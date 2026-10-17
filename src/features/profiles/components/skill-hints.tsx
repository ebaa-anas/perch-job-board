"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import {
  classifySkills,
  type SkillSuggestion,
} from "@/features/profiles/skill-suggestions";

/**
 * Tells a seeker which of their skills employers here actually search for.
 *
 * The match score compares their `skills` against a job's `tags`, so a skill
 * nobody tags jobs with contributes nothing — and until now there was no way
 * to know that. "AI Orientation" is a real thing to know and still earns zero
 * matches on this board.
 *
 * Phrased as information about the market, never as a correction of the
 * person: "not asked for by any job here yet", not "invalid skill". Free text
 * stays free — this reports, it does not rewrite.
 */
export function SkillHints({
  raw,
  corpus,
  onPick,
}: {
  /** The raw comma-separated field value. */
  raw: string;
  corpus: SkillSuggestion[];
  onPick: (skill: string) => void;
}) {
  const { t } = useLocale();

  const typed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { unmatched } = classifySkills(typed, corpus);

  // Suggest only what they have not already got, so the list shrinks as they
  // fill it in rather than nagging with the same chips.
  const already = new Set(typed.map((s) => s.toLowerCase()));
  const popular = corpus
    .filter((entry) => !already.has(entry.label.toLowerCase()))
    .slice(0, 8);

  if (unmatched.length === 0 && popular.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {unmatched.length > 0 && (
        <ul className="space-y-1">
          {unmatched.map((item) => (
            <li key={item.skill} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.skill}</span>
              {" — "}
              {item.suggestion ? (
                <>
                  {t.profile.skillsDidYouMean}{" "}
                  <button
                    type="button"
                    onClick={() => onPick(item.suggestion!)}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {item.suggestion}
                  </button>
                  ?
                </>
              ) : (
                t.profile.skillsUnknown
              )}
            </li>
          ))}
        </ul>
      )}

      {popular.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">{t.profile.skillsPopular}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {popular.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => onPick(entry.label)}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs transition-colors hover:border-primary hover:bg-accent"
              >
                {entry.label}
                <span className="ml-1 text-muted-foreground">{entry.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
