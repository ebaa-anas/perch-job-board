import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getProfile } from "@/features/auth/session";
import { getOwnCompany } from "@/features/companies/data";
import { CompanyForm } from "@/features/companies/components/company-form";
import { LogoUpload } from "@/features/companies/components/logo-upload";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyPage() {
  const [profile, company] = await Promise.all([getProfile(), getOwnCompany()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Company profile</h1>
          <p className="mt-1 text-muted-foreground">
            This is what candidates see on your public page and job posts.
          </p>
        </div>
        {company && (
          <Link
            href={`/companies/${company.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View public page
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </header>

      <div className="space-y-8">
        <LogoUpload
          uid={profile?.id ?? ""}
          logoPath={company?.logoPath ?? null}
          companyName={company?.name ?? "Your company"}
          logoColor={company?.logoColor ?? "#1e5f45"}
          disabled={!company}
        />
        <CompanyForm
          initial={{
            name: company?.name ?? "",
            slug: company?.slug ?? "",
            tagline: company?.tagline ?? "",
            description: company?.description ?? "",
            website: company?.website ?? "",
            language: company?.language ?? "en",
          }}
          hasCompany={Boolean(company)}
        />
      </div>
    </div>
  );
}
