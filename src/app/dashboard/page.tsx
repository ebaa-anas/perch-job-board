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

import { getProfile, requireUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

const SEEKER_LINKS = [
  { href: "/jobs", label: "Browse jobs", icon: Search },
  { href: "/saved-jobs", label: "Saved jobs", icon: Bookmark },
  { href: "/profile", label: "Your profile", icon: FileText },
];

const RECRUITER_LINKS = [
  { href: "/jobs/create", label: "Post a job", icon: Plus },
  { href: "/company", label: "Company profile", icon: Building2 },
  { href: "/jobs", label: "Browse the board", icon: Search },
];

export default async function DashboardPage() {
  await requireUser("/dashboard");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.role) redirect("/onboarding");

  const isRecruiter = profile.role === "recruiter";
  const links = isRecruiter ? RECRUITER_LINKS : SEEKER_LINKS;
  const firstName = profile.fullName?.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">
        {isRecruiter ? "Recruiter" : "Job seeker"}
      </p>
      <h1 className="font-display mt-1 text-4xl">
        {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
      </h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        {isRecruiter
          ? "Your hiring workspace. Posting tools and an applicant inbox arrive in the next release — here's what's live now."
          : "Your job-search workspace. Application tracking arrives in the next release — here's what's live now."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {links.map((link) => (
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
