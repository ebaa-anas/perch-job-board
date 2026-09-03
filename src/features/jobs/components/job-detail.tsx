import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Check,
  MapPin,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/features/jobs/components/company-logo";
import { ApplyCta } from "@/features/applications/components/apply-cta";
import {
  ExperienceBadge,
  JobTypeBadge,
  WorkModeBadge,
} from "@/features/jobs/components/job-badges";
import {
  EXPERIENCE_LABELS,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  type Job,
} from "@/features/jobs/types";
import {
  formatDate,
  formatRelativeDate,
  formatSalary,
} from "@/features/jobs/utils";
import { SaveJobButton } from "@/features/saved-jobs/components/save-job-button";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-relaxed">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OverviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export interface ApplyContext {
  state: "guest" | "seeker" | "applied" | "owner" | "other";
  hasCv: boolean;
  appliedVia?: "onsite" | "external";
}

export function JobDetail({
  job,
  apply,
}: {
  job: Job;
  apply: ApplyContext;
}) {
  return (
    <article className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All jobs
      </Link>

      <header className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <CompanyLogo
            company={job.company.name}
            color={job.company.logoColor}
            logoPath={job.company.logoPath}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl text-balance">{job.title}</h1>
            <p className="mt-1 text-muted-foreground">
              <Link
                href={`/companies/${job.company.slug}`}
                className="font-medium text-foreground hover:underline"
              >
                {job.company.name}
              </Link>{" "}
              · {job.location}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <JobTypeBadge type={job.type} />
              <WorkModeBadge mode={job.workMode} />
              <ExperienceBadge level={job.experience} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
          <ApplyCta
            jobId={job.id}
            jobSlug={job.slug}
            applyUrl={job.applyUrl}
            state={apply.state}
            hasCv={apply.hasCv}
            appliedVia={apply.appliedVia}
          />
          <SaveJobButton jobId={job.id} layout="full" />
          <p className="text-sm text-muted-foreground sm:ml-auto">
            Posted {formatRelativeDate(job.postedAt)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="About the role">
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {job.description}
            </p>
          </Section>
          <Section title="What you'll do">
            <BulletList items={job.responsibilities} />
          </Section>
          <Section title="What we're looking for">
            <BulletList items={job.requirements} />
          </Section>
          {job.perks.length > 0 && (
            <Section title="Perks & benefits">
              <BulletList items={job.perks} />
            </Section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Overview
            </h2>
            <div className="mt-2 divide-y divide-border">
              <OverviewRow
                icon={Wallet}
                label="Salary"
                value={formatSalary(job.salaryMin, job.salaryMax, job.currency)}
              />
              <OverviewRow
                icon={Briefcase}
                label="Employment"
                value={JOB_TYPE_LABELS[job.type]}
              />
              <OverviewRow
                icon={MapPin}
                label="Work mode"
                value={`${WORK_MODE_LABELS[job.workMode]} · ${job.location}`}
              />
              <OverviewRow
                icon={Check}
                label="Level"
                value={EXPERIENCE_LABELS[job.experience]}
              />
              <OverviewRow
                icon={CalendarDays}
                label="Date posted"
                value={formatDate(job.postedAt)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </h2>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {job.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
