"use client";

import * as React from "react";
import { Download, ExternalLink, Loader2, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/features/jobs/utils";
import { getInitials } from "@/features/jobs/utils";
import { getCvUrl } from "@/features/applications/actions";
import { answerLabel } from "@/features/applications/answers";
import { bulkSetApplicationStage } from "@/features/applications/pipeline-actions";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  isDecided,
  type ApplicationStage,
} from "@/features/applications/pipeline";
import { StageBadge } from "@/features/applications/components/stage-badge";
import { StagePicker } from "@/features/applications/components/stage-picker";
import { ApplicantActivity } from "@/features/applications/components/applicant-activity";
import {
  MatchBadge,
  MatchDetail,
} from "@/features/matching/components/match-badge";
import { scoreApplicant, sortByMatch } from "@/features/matching/applicant-match";
import type { ApplicationEvent, JobApplicant } from "@/features/applications/data";

type StageFilter = ApplicationStage | "all" | "awaiting";

type SortMode = "recent" | "match";

export function ApplicantsList({
  applicants,
  jobTitle,
  companyName,
  jobTags,
  events = {},
}: {
  applicants: JobApplicant[];
  jobTitle: string;
  companyName: string;
  /** The job's skill tags — what the match score is computed against. */
  jobTags: string[];
  /** Keyed by application id — see `getJobApplicationEvents`. */
  events?: Record<string, ApplicationEvent[]>;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = React.useState<StageFilter>("all");
  const [sort, setSort] = React.useState<SortMode>("recent");

  // Computed here rather than server-side: it is pure, instant, and depends
  // only on data already loaded, so there is nothing to fetch or cache.
  const matches = React.useMemo(() => {
    const byId: Record<string, ReturnType<typeof scoreApplicant>> = {};
    for (const applicant of applicants) {
      byId[applicant.id] = scoreApplicant({
        jobTags,
        seekerSkills: applicant.seeker.skills,
      });
    }
    return byId;
  }, [applicants, jobTags]);

  const active = applicants.find((a) => a.id === openId) ?? null;

  const visible = React.useMemo(() => {
    const filtered = applicants.filter((a) => {
      if (filter === "all") return true;
      if (filter === "awaiting") return !isDecided(a.stage);
      return a.stage === filter;
    });
    return sort === "match"
      ? sortByMatch(filtered, (a) => matches[a.id]?.score ?? null)
      : filtered;
  }, [applicants, filter, sort, matches]);

  const awaiting = applicants.filter((a) => !isDecided(a.stage)).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (applicants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No applications yet.
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="stage-filter" className="text-sm text-muted-foreground">
            Show
          </label>
          <Select
            id="stage-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StageFilter)}
            className="h-9 w-auto"
          >
            <option value="all">Everyone ({applicants.length})</option>
            <option value="awaiting">Awaiting a reply ({awaiting})</option>
            {APPLICATION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]} (
                {applicants.filter((a) => a.stage === stage).length})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="applicant-sort" className="text-sm text-muted-foreground">
            Sort
          </label>
          <Select
            id="applicant-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-9 w-auto"
          >
            <option value="recent">Most recent</option>
            <option value="match">Best skills match</option>
          </Select>
        </div>

        {awaiting > 0 && (
          <p className="text-xs text-muted-foreground">
            {awaiting} {awaiting === 1 ? "person is" : "people are"} still waiting to
            hear from you.
          </p>
        )}
      </div>

      {selected.size > 0 && (
        <BulkStageBar
          ids={[...selected]}
          onDone={() => setSelected(new Set())}
          onCancel={() => setSelected(new Set())}
        />
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {visible.map((a) => (
          <li key={a.id} className="flex items-center gap-3 pl-4">
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={() => toggle(a.id)}
              aria-label={`Select ${a.seeker.fullName || "applicant"}`}
              className="size-4 shrink-0 rounded border-input"
            />
            <button
              type="button"
              onClick={() => setOpenId(a.id)}
              className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-4 text-left transition-colors hover:bg-muted/50"
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
                  {a.rating !== null && (
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                      <Star className="size-3 fill-current" aria-hidden />
                      {a.rating}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {a.seeker.headline || "—"}
                  {a.seeker.location ? ` · ${a.seeker.location}` : ""}
                </span>
              </span>
              <span className="hidden shrink-0 sm:block">
                <MatchBadge match={matches[a.id]} />
              </span>
              <span className="shrink-0">
                <StageBadge stage={a.stage} />
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {formatDate(a.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Nobody is at that stage.
        </p>
      )}

      {active && (
        <ApplicantDrawer
          applicant={active}
          jobTitle={jobTitle}
          companyName={companyName}
          matches={matches}
          events={events[active.id] ?? []}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

/**
 * Bulk stage changes.
 *
 * Exists because rejecting forty people one at a time is the chore recruiters
 * skip, and skipping it is precisely what leaves candidates with no answer.
 */
function BulkStageBar({
  ids,
  onDone,
  onCancel,
}: {
  ids: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = React.useState<ApplicationStage | "">("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const apply = async () => {
    if (!stage) return;
    setBusy(true);
    setResult(null);
    const outcome = await bulkSetApplicationStage({ applicationIds: ids, stage });
    setBusy(false);
    if (!outcome.ok) {
      setResult(outcome.error);
      return;
    }
    setResult(
      outcome.failed > 0
        ? `Moved ${outcome.updated}; ${outcome.failed} could not be moved.`
        : `Moved ${outcome.updated}.`,
    );
    onDone();
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
      <span className="text-sm font-medium">
        {ids.length} selected
      </span>
      <Select
        value={stage}
        onChange={(e) => setStage(e.target.value as ApplicationStage)}
        disabled={busy}
        aria-label="Move selected applicants to"
        className="h-9 w-auto"
      >
        <option value="">Move to…</option>
        {APPLICATION_STAGES.map((option) => (
          <option key={option} value={option}>
            {STAGE_LABELS[option]}
          </option>
        ))}
      </Select>
      <Button size="sm" onClick={apply} disabled={busy || !stage}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        Clear
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}

function ApplicantDrawer({
  applicant,
  jobTitle,
  companyName,
  matches,
  events,
  onClose,
}: {
  applicant: JobApplicant;
  jobTitle: string;
  companyName: string;
  matches: Record<string, ReturnType<typeof scoreApplicant>>;
  events: ApplicationEvent[];
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
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              Applied {formatDate(applicant.createdAt)}
              <StageBadge stage={applicant.stage} />
            </p>
          </div>

          <MatchDetail match={matches[applicant.id]} />

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <StagePicker
              applicationId={applicant.id}
              stage={applicant.stage}
              jobTitle={jobTitle}
              companyName={companyName}
            />
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
                      {answerLabel(a.answer)}
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

          <div className="border-t border-border pt-5">
            <ApplicantActivity
              applicationId={applicant.id}
              rating={applicant.rating}
              events={events}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
