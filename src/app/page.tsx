import Link from "next/link";
import { ArrowRight, BookmarkPlus, PenLine, SlidersHorizontal } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getJobs } from "@/features/jobs/data";
import { JobCard } from "@/features/jobs/components/job-card";
import { HomeSearch } from "@/features/jobs/components/home-search";

// Always reflect the current jobs file (new posts show up immediately).
export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: SlidersHorizontal,
    title: "Search & filter",
    body: "Narrow thousands of roles by type, work mode, seniority and pay in a couple of clicks.",
  },
  {
    icon: BookmarkPlus,
    title: "Save what fits",
    body: "Bookmark roles as you go. Your shortlist stays on this device, ready when you are.",
  },
  {
    icon: PenLine,
    title: "Post a role",
    body: "Hiring? Publish a job with a guided form and see it live on the board immediately.",
  },
];

export default async function HomePage() {
  const jobs = await getJobs();
  const latest = jobs.slice(0, 6);
  const companyCount = new Set(jobs.map((job) => job.company)).size;

  return (
    <div>
      <section className="bg-mesh border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {jobs.length} open roles from {companyCount} companies
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Find where you land next
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
            A focused job board for product, design and engineering roles. Browse,
            filter, and shortlist in one place.
          </p>
          <HomeSearch />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Latest roles</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Freshly posted opportunities across the board.
            </p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View all jobs
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {latest.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">How Perch works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <step.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/jobs" className={buttonVariants({ size: "lg" })}>
              Browse all jobs
            </Link>
            <Link
              href="/jobs/create"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Post a job
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
