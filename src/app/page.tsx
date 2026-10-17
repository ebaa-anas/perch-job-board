import type { Metadata } from "next";
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
import {
  HeroSpotlight,
  RotatingWord,
} from "@/features/marketing/components/hero-motion";
import { getDictionary, interpolate } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Perch — Find where you land next" },
  description:
    "Browse and apply to product, design and engineering roles, or post a job and review applicants. One account, one place.",
  alternates: { canonical: "/" },
};

const SEEKER_ICONS = [SlidersHorizontal, BookmarkPlus, FileCheck2];
const RECRUITER_ICONS = [Building2, PenLine, SearchCheck];

export default async function HomePage() {
  const [jobs, t] = await Promise.all([getJobs(), getLocale().then(getDictionary)]);
  const latest = jobs.slice(0, 6);

  const companies = Array.from(
    new Map(jobs.map((j) => [j.company.slug, j.company])).values(),
  );

  return (
    <div>
      {/* Hero */}
      <section className="bg-editorial grain relative overflow-hidden border-b border-border">
        <HeroSpotlight />
        <div className="stagger relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-28">
          <Logo size={60} className="drop-shadow-sm" />
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            {interpolate(t.home.openRoles, {
              jobCount: jobs.length,
              companyCount: companies.length,
            })}
          </span>
          <h1 className="font-display max-w-3xl text-4xl text-balance sm:text-6xl md:text-7xl">
            {t.home.heroTitle}
            <span className="mt-1 block text-primary">
              <RotatingWord words={t.home.heroRotating} />
            </span>
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
            {t.home.heroSubtitle}
          </p>
          <HomeSearch />
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-sm">
            <Link href="/jobs" className={buttonVariants({ size: "lg" })}>
              {t.home.browseJobs}
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t.home.postJob}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
          <StatCounter value={jobs.length} label={t.home.statOpenRoles} />
          <StatCounter value={companies.length} label={t.home.statHiringCompanies} />
          <StatCounter value={100} suffix="%" label={t.home.statFreeToPost} />
        </div>
      </section>

      {/* Featured roles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl">{t.home.latestRoles}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.home.latestRolesSubtitle}
            </p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t.home.viewAllJobs}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          <h2 className="font-display text-3xl">{t.home.browseByArea}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.home.browseByAreaSubtitle}
          </p>
          <div className="mt-6">
            <CategoryGrid />
          </div>
        </div>
      </section>

      {/* How it works — two sides */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl">{t.home.howItWorks}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[
            {
              title: t.home.forJobSeekers,
              steps: t.home.seekerSteps,
              icons: SEEKER_ICONS,
              cta: { href: "/signup", label: t.home.createSeekerAccount },
            },
            {
              title: t.home.forRecruiters,
              steps: t.home.recruiterSteps,
              icons: RECRUITER_ICONS,
              cta: { href: "/signup", label: t.home.createRecruiterAccount },
            },
          ].map((col) => (
            <div
              key={col.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h3 className="font-display text-xl">{col.title}</h3>
              <ul className="mt-4 flex-1 space-y-4">
                {col.steps.map((step, i) => {
                  const Icon = col.icons[i];
                  return (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="pt-1.5 text-muted-foreground">{step}</span>
                    </li>
                  );
                })}
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
              {t.home.teamsHiring}
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
          <h2 className="font-display text-3xl sm:text-4xl">{t.home.hiringCtaTitle}</h2>
          <p className="max-w-lg text-primary-foreground/80">{t.home.hiringCtaSubtitle}</p>
          <Link
            href="/signup"
            className="mt-2 inline-flex h-11 items-center rounded-md bg-primary-foreground px-6 font-medium text-primary transition-opacity hover:opacity-90"
          >
            {t.home.getStarted}
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl">{t.home.questions}</h2>
        <div className="mt-6">
          <Faq />
        </div>
      </section>
    </div>
  );
}
