import Link from "next/link";
import { MapPin, Wallet } from "lucide-react";

import { CompanyLogo } from "@/features/jobs/components/company-logo";
import {
  ExperienceBadge,
  JobTypeBadge,
  WorkModeBadge,
} from "@/features/jobs/components/job-badges";
import { formatRelativeDate, formatSalary } from "@/features/jobs/utils";
import type { Job } from "@/features/jobs/types";
import { SaveJobButton } from "@/features/saved-jobs/components/save-job-button";

export function JobCard({ job }: { job: Job }) {
  return (
    <div className="group relative">
      <Link
        href={`/jobs/${job.id}`}
        className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-4">
          <CompanyLogo company={job.company} color={job.companyLogoColor} />
          <div className="min-w-0 flex-1 pr-10">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {job.title}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {job.company}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <JobTypeBadge type={job.type} />
          <WorkModeBadge mode={job.workMode} />
          <ExperienceBadge level={job.experience} />
        </div>

        <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{job.location}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Wallet className="size-3.5 shrink-0" />
            <span className="truncate">
              {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Posted {formatRelativeDate(job.postedAt)}</span>
        </div>
      </Link>

      <div className="absolute right-4 top-4">
        <SaveJobButton jobId={job.id} compact />
      </div>
    </div>
  );
}
