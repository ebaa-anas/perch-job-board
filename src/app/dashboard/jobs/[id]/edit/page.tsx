import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/features/auth/session";
import { getJobQuestions, getOwnJob } from "@/features/jobs/data";
import { JobEditorForm } from "@/features/jobs/components/job-editor-form";
import type { JobEditorValues } from "@/features/jobs/schema";

export const metadata: Metadata = { title: "Edit job", robots: { index: false, follow: false } };

export default async function EditJobPage({
  params,
}: PageProps<"/dashboard/jobs/[id]/edit">) {
  await requireRole("recruiter");
  const { id } = await params;
  const [job, questions] = await Promise.all([getOwnJob(id), getJobQuestions(id)]);
  if (!job) notFound();

  const initial: JobEditorValues = {
    title: job.title,
    location: job.location,
    type: job.type,
    workMode: job.workMode,
    experience: job.experience,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    description: job.description,
    responsibilities: job.responsibilities.join("\n"),
    requirements: job.requirements.join("\n"),
    perks: job.perks.join("\n"),
    tags: job.tags.join(", "),
    noExperienceRequired: job.noExperienceRequired,
    visaSponsorship: job.visaSponsorship,
    language: job.language,
    questions: questions.map((q) => ({
      label: q.label,
      type: q.type,
      required: q.required,
      options: q.options,
      knockoutAnswer: q.knockoutAnswer ?? "",
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>
      <h1 className="font-display mt-2 text-4xl">Edit job</h1>
      <p className="mt-1 text-muted-foreground">
        {job.title} ·{" "}
        <span className="capitalize">{job.status}</span>
      </p>

      <div className="mt-8">
        <JobEditorForm mode="edit" jobId={job.id} initial={initial} />
      </div>
    </div>
  );
}
