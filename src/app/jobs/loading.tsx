import { Skeleton } from "@/components/ui/skeleton";
import { JobListSkeleton } from "@/features/jobs/components/job-skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[310px_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <JobListSkeleton />
      </div>
    </div>
  );
}
