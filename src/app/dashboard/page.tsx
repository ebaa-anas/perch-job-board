import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Building2,
  ChartNoAxesColumn,
  FileText,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getProfile, requireUser } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { getOwnJobs } from "@/features/jobs/data";
import { RecruiterJobs } from "@/features/jobs/components/recruiter-jobs";
import {
  getApplicantCountsForOwner,
  getMyApplications,
} from "@/features/applications/data";
import { formatRelativeDate } from "@/features/jobs/utils";
import { StatusBadge } from "@/features/applications/components/stage-badge";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

const SEEKER_LINKS = [
  { href: "/jobs", label: "Browse jobs", icon: Search },
  { href: "/saved-jobs", label: "Saved jobs", icon: Bookmark },
  { href: "/alerts", label: "Job alerts", icon: Bell },
  { href: "/profile", label: "Your profile", icon: FileText },
];

export default async function DashboardPage() {
  await requireUser("/dashboard");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.role) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");

  const firstName = profile.fullName?.split(/\s+/)[0];
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  if (profile.role === "recruiter") {
    const [company, jobs, applicantCounts] = await Promise.all([
      getOwnCompany(),
      getOwnJobs(),
      getApplicantCountsForOwner(),
    ]);
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Recruiter</p>
            <h1 className="font-display mt-1 text-4xl">{greeting}</h1>
          </div>
          {company && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/analytics"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <ChartNoAxesColumn className="size-4" />
                Analytics
              </Link>
              <Link
                href="/company/team"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <Users className="size-4" />
                Team
              </Link>
              <Link
                href="/dashboard/jobs/new"
                className={buttonVariants({ size: "lg" })}
              >
                <Plus className="size-4" />
                Post a job
              </Link>
            </div>
          )}
        </div>

        {!company ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl">Set up your company</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add your company name and details before posting a job — it&apos;s
              what candidates see on every listing.
            </p>
            <Link href="/company" className={`${buttonVariants()} mt-4`}>
              Create company profile
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <RecruiterJobs jobs={jobs} applicantCounts={applicantCounts} />
          </div>
        )}
      </div>
    );
  }

  // Seeker
  const applications = await getMyApplications();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">Job seeker</p>
      <h1 className="font-display mt-1 text-4xl">{greeting}</h1>

      <section className="mt-8">
        <h2 className="font-display text-2xl">
          My applications{" "}
          <span className="text-muted-foreground">({applications.length})</span>
        </h2>
        {applications.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            You haven&apos;t applied to anything yet.{" "}
            <Link href="/jobs" className="text-primary hover:underline">
              Browse jobs
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {applications.map((app) => (
              <li
                key={app.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/jobs/${app.job.slug}`}
                      className="font-medium hover:underline"
                    >
                      {app.job.title}
                    </Link>
                    {app.via === "external" && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                        via company site
                      </span>
                    )}
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <Link
                      href={`/companies/${app.job.company.slug}`}
                      className="hover:underline"
                    >
                      {app.job.company.name}
                    </Link>{" "}
                    · applied {formatRelativeDate(app.createdAt)}
                    {app.decidedAt
                      ? ` · answered ${formatRelativeDate(app.decidedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {app.job.status !== "published" && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {app.job.status === "closed" ? "Role closed" : "Not live"}
                    </span>
                  )}
                  <StatusBadge status={app.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEEKER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary hover:bg-accent"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <link.icon className="size-5" />
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                {link.label}
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
