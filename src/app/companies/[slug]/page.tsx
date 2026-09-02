import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";

import { CompanyLogo } from "@/features/jobs/components/company-logo";
import { JobList } from "@/features/jobs/components/job-list";
import { getCompanyBySlug, getCompanyJobs } from "@/features/companies/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: company.name,
    description:
      company.tagline ?? `Open roles at ${company.name} on Perch.`,
  };
}

export default async function CompanyPublicPage({
  params,
}: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const jobs = await getCompanyJobs(company.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-start">
        <CompanyLogo
          company={company.name}
          color={company.logoColor}
          logoPath={company.logoPath}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl">{company.name}</h1>
          {company.tagline && (
            <p className="mt-1 text-muted-foreground">{company.tagline}</p>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Globe className="size-4" />
              {company.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </header>

      {company.description && (
        <p className="mt-8 max-w-prose whitespace-pre-line text-pretty text-muted-foreground">
          {company.description}
        </p>
      )}

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
    </div>
  );
}
