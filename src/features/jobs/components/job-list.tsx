import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { JobCard } from "@/features/jobs/components/job-card";
import type { Job } from "@/features/jobs/types";

export function JobList({
  jobs,
  emptyTitle = "No jobs match your filters",
  emptyDescription = "Try removing a filter or broadening your search.",
}: {
  jobs: Job[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
            Reset filters
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <li key={job.id} className="animate-fade-up">
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}
