"use client";

import * as React from "react";
import { Lightbulb } from "lucide-react";

import {
  LINT_CATEGORY_LABELS,
  lintInclusiveLanguage,
} from "@/features/jobs/inclusive-language";

/**
 * Live wording advice under the description field.
 *
 * Advisory by construction: it has no bearing on validation and nothing here
 * can stop a posting going live. The wording belongs to the employer, and a
 * linter that blocked publishing would simply be worked around.
 *
 * Runs in the browser on the text already in the form — no request, no cost,
 * and an unpublished posting never leaves the page to be analysed.
 */
export function InclusiveLanguageHints({ text }: { text: string }) {
  const findings = React.useMemo(() => lintInclusiveLanguage(text), [text]);

  if (findings.length === 0) return null;

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
        <Lightbulb className="size-3.5" aria-hidden />
        Wording suggestions ({findings.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Optional. Phrasing like this is known to narrow who applies — change it
        or ignore it, nothing here blocks publishing.
      </p>
      <ul className="mt-2 space-y-1.5">
        {findings.map((finding) => (
          <li key={finding.term} className="text-xs">
            <span className="font-medium">“{finding.term}”</span>
            {finding.occurrences > 1 && (
              <span className="text-muted-foreground"> ×{finding.occurrences}</span>
            )}
            <span className="text-muted-foreground">
              {" "}
              · {LINT_CATEGORY_LABELS[finding.category]} · try{" "}
              {finding.suggestion}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
