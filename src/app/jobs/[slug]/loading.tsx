import { JobDetailSkeleton } from "@/features/jobs/components/job-skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JobDetailSkeleton />
    </div>
  );
}
