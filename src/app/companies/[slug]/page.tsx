import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe, ShieldAlert } from "lucide-react";

import { CompanyLogo } from "@/features/jobs/components/company-logo";
import { JobList } from "@/features/jobs/components/job-list";
import { getCompanyBySlug, getCompanyJobs } from "@/features/companies/data";
import {
  getCompanyReviews,
  getOwnReview,
  getReviewSummary,
} from "@/features/companies/reviews";
import { getProfile } from "@/features/auth/session";
import { ReportCompanyButton } from "@/features/companies/components/report-company-dialog";
import { CompanyReviews } from "@/features/companies/components/company-reviews";
import { Stars } from "@/features/companies/components/stars";
import { getCompanyResponseRate } from "@/features/applications/data";
import { ResponseRateBadge } from "@/features/applications/components/response-rate-badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  const { avg, count } = await getReviewSummary(company.id);
  const rated = count > 0 ? ` · ${avg}★ (${count})` : "";
  return {
    title: company.name,
    description:
      (company.tagline ?? `Open roles at ${company.name} on Perch.`) + rated,
  };
}

export default async function CompanyPublicPage({
  params,
}: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  const [company, profile] = await Promise.all([
    getCompanyBySlug(slug),
    getProfile(),
  ]);
  if (!company) notFound();

  const isAdmin = profile?.role === "admin";
  const isOwner = Boolean(profile) && profile?.id === company.ownerId;
  const isSeeker = profile?.role === "seeker";
  const suspended = Boolean(company.suspendedAt);
  const showJobs = !suspended || isAdmin || isOwner;

  const [jobs, summary, reviews, ownReview, responseRate] = await Promise.all([
    showJobs ? getCompanyJobs(company.id) : Promise.resolve([]),
    getReviewSummary(company.id),
    getCompanyReviews(company.id),
    isSeeker && !isOwner ? getOwnReview(company.id) : Promise.resolve(null),
    getCompanyResponseRate(company.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {suspended && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-highlight/30 bg-highlight/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-highlight" />
          <div>
            <p className="font-medium">This company is under review</p>
            <p className="text-muted-foreground">
              {isOwner
                ? `Your company is suspended: ${company.suspendedReason}. New and existing posts are hidden from the public board until an admin reinstates it.`
                : "Its job posts are hidden while our team looks into it."}
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-start">
        <CompanyLogo
          company={company.name}
          color={company.logoColor}
          logoPath={company.logoPath}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl">{company.name}</h1>
          {summary.avg != null && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Stars value={summary.avg} />
              <span className="font-medium">{summary.avg.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({summary.count})
              </span>
            </p>
          )}
          {company.tagline && (
            <p className="mt-1 text-muted-foreground">{company.tagline}</p>
          )}
          {responseRate && (
            <p className="mt-1.5">
              <ResponseRateBadge
                rate={responseRate.rate}
                total={responseRate.total}
              />
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Globe className="size-4" />
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {!isOwner && (
              <ReportCompanyButton
                companyId={company.id}
                companySlug={company.slug}
                canReport={Boolean(profile)}
              />
            )}
          </div>
        </div>
      </header>

      {company.description && (
        <p className="mt-8 max-w-prose whitespace-pre-line text-pretty text-muted-foreground">
          {company.description}
        </p>
      )}

      {showJobs && (
        <section className="mt-10">
          <h2 className="font-display text-2xl">
            Open roles{" "}
            <span className="text-muted-foreground">({jobs.length})</span>
          </h2>
          <div className="mt-4">
            <JobList
              jobs={jobs}
              emptyTitle="No open roles right now"
              emptyDescription="This company hasn't published any jobs yet."
            />
          </div>
        </section>
      )}

      <CompanyReviews
        companyId={company.id}
        companyName={company.name}
        summary={summary}
        reviews={reviews}
        canReview={isSeeker && !isOwner}
        isGuest={!profile}
        ownReview={ownReview}
      />
    </div>
  );
}
