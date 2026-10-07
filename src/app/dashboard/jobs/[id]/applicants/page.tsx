import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/features/auth/session";
import { getOwnJob } from "@/features/jobs/data";
import {
  getJobApplicants,
  getJobApplicationEvents,
} from "@/features/applications/data";
import { ApplicantsList } from "@/features/applications/components/applicants-list";

export const metadata: Metadata = { title: "Applicants", robots: { index: false, follow: false } };

export default async function ApplicantsPage({
  params,
}: PageProps<"/dashboard/jobs/[id]/applicants">) {
  await requireRole("recruiter");
  const { id } = await params;
  const job = await getOwnJob(id);
  if (!job) notFound();

  const [applicants, events] = await Promise.all([
    getJobApplicants(job.id),
    getJobApplicationEvents(job.id),
  ]);

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

      <div className="mt-8">
        <ApplicantsList
          applicants={applicants}
          jobTitle={job.title}
          companyName={job.company.name}
          events={events}
        />
      </div>
    </div>
  );
}
