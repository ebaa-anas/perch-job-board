import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJobBySlug } from "@/features/jobs/data";
import { JobDetail } from "@/features/jobs/components/job-detail";

export async function generateMetadata({
  params,
}: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Job not found" };
  return {
    title: `${job.title} · ${job.company.name}`,
    description: job.description.slice(0, 155),
  };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JobDetail job={job} />
    </div>
  );
}
