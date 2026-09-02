import type { Metadata } from "next";

import { getJobs } from "@/features/jobs/data";
import { SavedJobsList } from "@/features/saved-jobs/components/saved-jobs-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved jobs",
  description: "The roles you've bookmarked, kept on this device.",
};

export default async function SavedJobsPage() {
  // Load every job on the server; the client list picks out the saved ids.
  const jobs = await getJobs();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl">Saved jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Your shortlist is stored in this browser — it stays private to you.
        </p>
      </header>
      <div className="mt-6">
        <SavedJobsList jobs={jobs} />
      </div>
    </div>
  );
}
