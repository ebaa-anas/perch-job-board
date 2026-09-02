import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Building2,
  FileText,
  Plus,
  Search,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getProfile, requireUser } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { getOwnJobs } from "@/features/jobs/data";
import { RecruiterJobs } from "@/features/jobs/components/recruiter-jobs";

export const metadata: Metadata = { title: "Dashboard" };

const SEEKER_LINKS = [
  { href: "/jobs", label: "Browse jobs", icon: Search },
  { href: "/saved-jobs", label: "Saved jobs", icon: Bookmark },
  { href: "/profile", label: "Your profile", icon: FileText },
];

export default async function DashboardPage() {
  await requireUser("/dashboard");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.role) redirect("/onboarding");

  const firstName = profile.fullName?.split(/\s+/)[0];
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  if (profile.role === "recruiter") {
    const [company, jobs] = await Promise.all([getOwnCompany(), getOwnJobs()]);
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Recruiter</p>
            <h1 className="font-display mt-1 text-4xl">{greeting}</h1>
          </div>
          {company && (
            <Link
              href="/dashboard/jobs/new"
              className={buttonVariants({ size: "lg" })}
            >
              <Plus className="size-4" />
              Post a job
            </Link>
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
            <RecruiterJobs jobs={jobs} />
          </div>
        )}
      </div>
    );
  }

  // Seeker
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">Job seeker</p>
      <h1 className="font-display mt-1 text-4xl">{greeting}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Your job-search workspace. Application tracking arrives in the next
        release — here&apos;s what&apos;s live now.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
    </div>
  );
}
