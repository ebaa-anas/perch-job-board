import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getJobBySlug } from "@/features/jobs/data";
import { JobDetail, type ApplyContext } from "@/features/jobs/components/job-detail";
import { getProfile } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { getApplyRecord } from "@/features/applications/data";

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

async function resolveApplyContext(
  jobId: string,
  companyId: string,
): Promise<ApplyContext> {
  const profile = await getProfile();
  if (!profile) return { state: "guest", hasCv: false };
  if (!profile.role) return { state: "guest", hasCv: false };

  if (profile.role === "recruiter") {
    const company = await getOwnCompany();
    return {
      state: company?.id === companyId ? "owner" : "other",
      hasCv: false,
    };
  }
  if (profile.role === "admin") return { state: "other", hasCv: false };

  // seeker
  const [record, seeker] = await Promise.all([
    getApplyRecord(jobId),
    getOwnSeekerProfile(),
  ]);
  return {
    state: record ? "applied" : "seeker",
    hasCv: Boolean(seeker?.cvPath),
    appliedVia: record?.via,
  };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const apply = await resolveApplyContext(job.id, job.companyId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <JobDetail job={job} apply={apply} />
    </div>
  );
}
