"use client";

import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobCard } from "@/features/jobs/components/job-card";
import type { Job } from "@/features/jobs/types";
import { useSavedJobs } from "@/features/saved-jobs/saved-jobs-provider";

export function SavedJobsList({ jobs }: { jobs: Job[] }) {
  const { savedIds, hydrated, clear } = useSavedJobs();

  if (!hydrated) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-52 rounded-xl" />
        ))}
      </div>
    );
  }

  const byId = new Map(jobs.map((job) => [job.id, job]));
  const savedJobs = savedIds
    .map((id) => byId.get(id))
    .filter((job): job is Job => Boolean(job));

  if (savedJobs.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved jobs yet"
        description="Tap the bookmark on any job to keep it here for later."
        action={
          <Link href="/jobs" className={buttonVariants()}>
            Browse jobs
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {savedJobs.length} saved {savedJobs.length === 1 ? "job" : "jobs"}
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          <Trash2 className="size-4" />
          Clear all
        </Button>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {savedJobs.map((job) => (
          <li key={job.id} className="animate-fade-up">
            <JobCard job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}
