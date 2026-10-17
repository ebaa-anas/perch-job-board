import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { JobImport } from "@/features/jobs/components/job-import";

export const metadata: Metadata = {
  title: "Import jobs",
  robots: { index: false, follow: false },
};

export default async function ImportJobsPage() {
  await requireRole("recruiter", "/dashboard/jobs/import");
  const company = await getOwnCompany();

  if (!company) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl">Import jobs</h1>
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-2xl">Set up your company first</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Imported jobs are posted under your company, so it needs a profile
            before anything can be brought in.
          </p>
          <Link href="/company" className={`${buttonVariants()} mt-4`}>
            Create company profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Import jobs</h1>
          <p className="mt-1 text-muted-foreground">
            Bring a batch of roles in from a spreadsheet instead of typing them
            one at a time.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
      </header>

      <JobImport />
    </div>
  );
}
