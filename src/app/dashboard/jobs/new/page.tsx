import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { JobEditorForm } from "@/features/jobs/components/job-editor-form";

export const metadata: Metadata = { title: "Post a job", robots: { index: false, follow: false } };

export default async function NewJobPage() {
  await requireRole("recruiter", "/dashboard/jobs/new");
  const company = await getOwnCompany();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <h1 className="font-display mt-2 text-4xl">Post a job</h1>
      <p className="mt-1 text-muted-foreground">
        {company
          ? `Posting as ${company.name}.`
          : "Set up your company first."}
      </p>

      <div className="mt-8">
        {company ? (
          <JobEditorForm mode="new" />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You need a company profile before posting a job.
            </p>
            <Link href="/company" className={`${buttonVariants()} mt-4`}>
              Create company profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
