import Link from "next/link";

import { formatRelativeDate, formatSalaryCompact } from "@/features/jobs/utils";
import { JOB_TYPE_LABELS, WORK_MODE_LABELS } from "@/features/jobs/types";
import type { Job } from "@/features/jobs/types";
import { JobStatusActions } from "@/features/jobs/components/job-status-actions";

const GROUPS: { status: Job["status"]; label: string }[] = [
  { status: "published", label: "Published" },
  { status: "draft", label: "Drafts" },
  { status: "closed", label: "Closed" },
];

const STATUS_DOT: Record<Job["status"], string> = {
  published: "bg-primary",
  draft: "bg-highlight",
  closed: "bg-muted-foreground",
};

export function RecruiterJobs({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="font-display text-2xl">No jobs yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Post your first role — save it as a draft or publish it straight away.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GROUPS.map(({ status, label }) => {
        const group = jobs.filter((j) => j.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
              {label}
              <span className="font-normal">({group.length})</span>
            </h2>
            <ul className="mt-3 space-y-3">
              {group.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{job.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {JOB_TYPE_LABELS[job.type]} · {WORK_MODE_LABELS[job.workMode]}{" "}
                      · {job.location} ·{" "}
                      {formatSalaryCompact(job.salaryMin, job.salaryMax, job.currency)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {status === "published" ? "Published" : "Updated"}{" "}
                      {formatRelativeDate(job.postedAt)} ·{" "}
                      <Link
                        href={`/dashboard/jobs/${job.id}/applicants`}
                        className="text-primary hover:underline"
                      >
                        Applicants
                      </Link>
                    </p>
                  </div>
                  <JobStatusActions
                    jobId={job.id}
                    slug={job.slug}
                    status={job.status}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
