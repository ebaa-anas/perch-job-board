import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getJobById } from "@/features/jobs/data";
import { JobDetail } from "@/features/jobs/components/job-detail";

export async function generateMetadata({
  params,
}: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return { title: "Job not found" };
  return {
    title: `${job.title} · ${job.company}`,
    description: job.description.slice(0, 155),
  };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JobDetail job={job} />
    </div>
  );
}
