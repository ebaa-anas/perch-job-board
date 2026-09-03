import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/features/auth/session";
import { getOwnJob } from "@/features/jobs/data";
import { getJobApplicants } from "@/features/applications/data";
import { ApplicantsList } from "@/features/applications/components/applicants-list";

export const metadata: Metadata = { title: "Applicants", robots: { index: false, follow: false } };

export default async function ApplicantsPage({
  params,
}: PageProps<"/dashboard/jobs/[id]/applicants">) {
  await requireRole("recruiter");
  const { id } = await params;
  const job = await getOwnJob(id);
  if (!job) notFound();

  const applicants = await getJobApplicants(job.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <h1 className="font-display mt-2 text-4xl">Applicants</h1>
      <p className="mt-1 text-muted-foreground">
        {job.title} · {applicants.length}{" "}
        {applicants.length === 1 ? "person" : "people"}
      </p>

      {job.applyUrl && (
        <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This role links out to your own application form. The people below
          clicked through from Perch — their full application (note, CV) lives on
          your site, not here.
        </p>
      )}

      <div className="mt-8">
        <ApplicantsList applicants={applicants} />
      </div>
    </div>
  );
}
