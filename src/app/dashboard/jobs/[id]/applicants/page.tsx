import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/features/auth/session";
import { getOwnJob } from "@/features/jobs/data";

export const metadata: Metadata = { title: "Applicants" };

export default async function ApplicantsPage({
  params,
}: PageProps<"/dashboard/jobs/[id]/applicants">) {
  await requireRole("recruiter");
  const { id } = await params;
  const job = await getOwnJob(id);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <h1 className="font-display mt-2 text-4xl">Applicants</h1>
      <p className="mt-1 text-muted-foreground">{job.title}</p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        On-site applications open in the next release. Applicants who apply will
        show up here with their profile, note and CV.
      </div>
    </div>
  );
}
