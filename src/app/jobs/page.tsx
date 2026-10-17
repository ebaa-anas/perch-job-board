import type { Metadata } from "next";

import { getJobs } from "@/features/jobs/data";
import { JobFilters } from "@/features/jobs/components/job-filters";
import { JobList } from "@/features/jobs/components/job-list";
import {
  filterAndSortJobs,
  filtersToSearchParams,
  parseJobFilters,
} from "@/features/jobs/utils";
import { getProfile } from "@/features/auth/session";
import { hasSavedSearch } from "@/features/alerts/data";
import { describeFilters } from "@/features/alerts/describe";
import { SaveSearchButton } from "@/features/alerts/components/save-search-button";

export const metadata: Metadata = {
  title: "Browse jobs",
  description: "Search and filter open roles by type, work mode, and salary.",
};

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const filters = parseJobFilters(await searchParams);
  const query = filtersToSearchParams(filters).toString();

  const [allJobs, profile, alreadySaved] = await Promise.all([
    getJobs(),
    getProfile(),
    hasSavedSearch(query),
  ]);
  const jobs = filterAndSortJobs(allJobs, filters);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl">Browse jobs</h1>
        <p className="mt-1 text-muted-foreground">
          {allJobs.length} roles on the board. Filter down to the ones that fit.
        </p>
      </header>

      <div className="mt-4">
        <SaveSearchButton
          query={query}
          alreadySaved={alreadySaved}
          suggestedLabel={describeFilters(filters)}
          signedInAsSeeker={profile?.role === "seeker"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[310px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <JobFilters filters={filters} resultCount={jobs.length} />
        </div>
        <JobList jobs={jobs} />
      </div>
    </div>
  );
}
