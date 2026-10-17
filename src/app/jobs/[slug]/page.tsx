import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getJobBySlug, getJobQuestions } from "@/features/jobs/data";
import { JobDetail, type ApplyContext } from "@/features/jobs/components/job-detail";
import { getProfile } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { hasApplied } from "@/features/applications/data";
import {
  buildJobPostingJsonLd,
  serializeJsonLd,
} from "@/features/jobs/job-posting-jsonld";
import { TrackJobView } from "@/features/analytics/components/track-job-view";
import { getBenchmarkForJob } from "@/features/salary/data";
import { SalaryBenchmark } from "@/features/salary/components/salary-benchmark";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export async function generateMetadata({
  params,
}: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Job not found" };
  return {
    title: `${job.title} · ${job.company.name}`,
    description: job.description.slice(0, 155),
    alternates: { canonical: `${SITE_URL}/jobs/${job.slug}` },
    openGraph: {
      type: "article",
      title: `${job.title} · ${job.company.name}`,
      description: job.description.slice(0, 155),
      url: `${SITE_URL}/jobs/${job.slug}`,
    },
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
  const [applied, seeker] = await Promise.all([
    hasApplied(jobId),
    getOwnSeekerProfile(),
  ]);
  return {
    state: applied ? "applied" : "seeker",
    hasCv: Boolean(seeker?.cvPath),
  };
}

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const [apply, questions, benchmark] = await Promise.all([
    resolveApplyContext(job.id, job.companyId),
    getJobQuestions(job.id),
    getBenchmarkForJob(job.id),
  ]);

  const jsonLd = buildJobPostingJsonLd(job, SITE_URL);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Google for Jobs eligibility. Rendered server-side so it is present in
          the initial HTML, which is all a crawler reads. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <TrackJobView jobId={job.id} />
      <JobDetail job={job} apply={apply} questions={questions} />
      {benchmark && (
        <div className="mt-6">
          <SalaryBenchmark job={job} benchmark={benchmark} />
        </div>
      )}
    </div>
  );
}
