"use client";

import * as React from "react";
import { Download, ExternalLink, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/jobs/utils";
import { getInitials } from "@/features/jobs/utils";
import { getCvUrl } from "@/features/applications/actions";
import type { JobApplicant } from "@/features/applications/data";

export function ApplicantsList({ applicants }: { applicants: JobApplicant[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const active = applicants.find((a) => a.id === openId) ?? null;

  if (applicants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No applications yet.
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {applicants.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpenId(a.id)}
              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                {getInitials(a.seeker.fullName || "Applicant")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {a.seeker.fullName || "Applicant"}
                  </span>
                  {a.via === "external" && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                      via company site
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {a.seeker.headline || "—"}
                  {a.seeker.location ? ` · ${a.seeker.location}` : ""}
                </span>
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {formatDate(a.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <ApplicantDrawer applicant={active} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function ApplicantDrawer({
  applicant,
  onClose,
}: {
  applicant: JobApplicant;
  onClose: () => void;
}) {
  const [cvBusy, setCvBusy] = React.useState(false);
  const [cvError, setCvError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const downloadCv = async () => {
    setCvBusy(true);
    setCvError(null);
    const result = await getCvUrl(applicant.id);
    setCvBusy(false);
    if (!result.ok) {
      setCvError(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const links = [
    { label: "Portfolio", href: applicant.seeker.portfolioUrl },
    { label: "LinkedIn", href: applicant.seeker.linkedinUrl },
    { label: "GitHub", href: applicant.seeker.githubUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Applicant detail"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-xl">
            {applicant.seeker.fullName || "Applicant"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-5 p-5 text-sm">
          <div>
            <p className="font-medium">{applicant.seeker.headline || "—"}</p>
            {applicant.seeker.location && (
              <p className="text-muted-foreground">{applicant.seeker.location}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Applied {formatDate(applicant.createdAt)}
            </p>
          </div>

          {applicant.via === "external" && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Applied through your external link — their note and CV are on your
              own site, not here.
            </p>
          )}

          {applicant.seeker.bio && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                About
              </h3>
              <p className="mt-1 whitespace-pre-line">{applicant.seeker.bio}</p>
            </div>
          )}

          {applicant.seeker.skills.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Skills
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {applicant.seeker.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {applicant.note && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Note
              </h3>
              <p className="mt-1 whitespace-pre-line">{applicant.note}</p>
            </div>
          )}

          {applicant.customAnswers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Application questions
              </h3>
              <dl className="mt-1.5 space-y-3">
                {applicant.customAnswers.map((a) => (
                  <div key={a.questionId}>
                    <dt className="font-medium">{a.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">
                      {a.type === "yes_no" ? (a.answer ? "Yes" : "No") : String(a.answer) || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {links.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Links
              </h3>
              <ul className="mt-1 space-y-1">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {l.label}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CV
            </h3>
            {applicant.hasCv ? (
              <div className="mt-1.5 space-y-1.5">
                <Button variant="outline" onClick={downloadCv} disabled={cvBusy}>
                  {cvBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {applicant.cvFilename || "Download CV"}
                </Button>
                {cvError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{cvError}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">No CV attached.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
