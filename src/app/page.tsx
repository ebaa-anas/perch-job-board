import Link from "next/link";
import {
  ArrowRight,
  BookmarkPlus,
  Building2,
  FileCheck2,
  PenLine,
  SearchCheck,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { getJobs } from "@/features/jobs/data";
import { getInitials } from "@/features/jobs/utils";
import { JobCard } from "@/features/jobs/components/job-card";
import { HomeSearch } from "@/features/jobs/components/home-search";
import { StatCounter } from "@/features/marketing/components/stat-counter";
import { CategoryGrid } from "@/features/marketing/components/category-grid";
import { Faq } from "@/features/marketing/components/faq";

export const dynamic = "force-dynamic";

const SEEKER_STEPS = [
  { icon: SlidersHorizontal, text: "Search and filter by type, work mode, seniority and pay." },
  { icon: BookmarkPlus, text: "Save roles as you go — they sync to your account when you sign in." },
  { icon: FileCheck2, text: "Apply on-site with a note and your CV. Track every application in one place." },
];

const RECRUITER_STEPS = [
  { icon: Building2, text: "Set up your company page — logo, tagline, the pitch." },
  { icon: PenLine, text: "Post a role as a draft or publish it live to the board instantly." },
  { icon: SearchCheck, text: "Review applicants with their profile, note and CV, and get an email on every new one." },
];

export default async function HomePage() {
  const jobs = await getJobs();
  const latest = jobs.slice(0, 6);

  const companies = Array.from(
    new Map(jobs.map((j) => [j.company.slug, j.company])).values(),
  );

  return (
    <div>
      {/* Hero */}
      <section className="bg-editorial grain border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
          <Logo size={60} className="drop-shadow-sm" />
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            {jobs.length} open roles from {companies.length} companies
          </span>
          <h1 className="font-display max-w-3xl text-4xl text-balance sm:text-6xl md:text-7xl">
            Find where you land next
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
            A two-sided job board for product, design and engineering. Browse and
            apply as a seeker, or post roles and review applicants as a recruiter
            — one account, one place.
          </p>
          <HomeSearch />
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-sm">
            <Link href="/jobs" className={buttonVariants({ size: "lg" })}>
              Browse jobs
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Post a job
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
          <StatCounter value={jobs.length} label="Open roles" />
          <StatCounter value={companies.length} label="Hiring companies" />
          <StatCounter value={100} suffix="%" label="Free to post" />
        </div>
      </section>

      {/* Featured roles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl">Latest roles</h2>
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

      {/* Browse by category */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl">Browse by area</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump straight to what you do.
          </p>
          <div className="mt-6">
            <CategoryGrid />
          </div>
        </div>
      </section>

      {/* How it works — two sides */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl">How Perch works</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[
            { title: "For job seekers", steps: SEEKER_STEPS, cta: { href: "/signup", label: "Create a seeker account" } },
            { title: "For recruiters", steps: RECRUITER_STEPS, cta: { href: "/signup", label: "Create a recruiter account" } },
          ].map((col) => (
            <div
              key={col.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="font-display text-xl">{col.title}</h3>
              <ul className="mt-4 flex-1 space-y-4">
                {col.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <step.icon className="size-4" />
                    </span>
                    <span className="pt-1.5 text-muted-foreground">{step.text}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={col.cta.href}
                className={`${buttonVariants({ variant: "outline" })} mt-5`}
              >
                {col.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Companies strip */}
      {companies.length > 0 && (
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Teams hiring on Perch
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {companies.slice(0, 14).map((c) => (
                <Link
                  key={c.slug}
                  href={`/companies/${c.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary"
                >
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full text-[0.6rem] font-bold"
                    style={{ backgroundColor: `${c.logoColor}1f`, color: c.logoColor }}
                  >
                    {getInitials(c.name)}
                  </span>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recruiter CTA band */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
          <UploadCloud className="size-8" />
          <h2 className="font-display text-3xl sm:text-4xl">Hiring? Post your first role free</h2>
          <p className="max-w-lg text-primary-foreground/80">
            Create a company page, publish a job, and start reviewing applicants
            today. No card, no catch.
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-flex h-11 items-center rounded-md bg-primary-foreground px-6 font-medium text-primary transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl">Questions</h2>
        <div className="mt-6">
          <Faq />
        </div>
      </section>
    </div>
  );
}
