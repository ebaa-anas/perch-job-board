import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/features/jobs/components/company-logo";
import { getCompanyAdminDetail } from "@/features/admin/data";
import { CompanyModeration } from "@/features/admin/components/company-moderation";
import { formatDate } from "@/features/jobs/utils";

export const metadata: Metadata = { title: "Admin · Company" };
export const dynamic = "force-dynamic";

export default async function AdminCompanyDetailPage({
  params,
}: PageProps<"/admin/companies/[id]">) {
  const { id } = await params;
  const detail = await getCompanyAdminDetail(id);
  if (!detail) notFound();

  const { company, ownerEmail, jobs, reports } = detail;
  const openReports = reports.filter((r) => r.status === "open");

  return (
    <div className="space-y-8">
      <Link
        href="/admin/companies"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All companies
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <CompanyLogo
          company={company.name}
          color={company.logoColor}
          logoPath={company.logoPath}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl">{company.name}</h2>
          <p className="text-sm text-muted-foreground">
            {ownerEmail ?? "no owner"} ·{" "}
            <Link href={`/companies/${company.slug}`} className="hover:underline">
              /companies/{company.slug}
            </Link>
          </p>
          {company.suspendedAt && (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              Suspended {formatDate(company.suspendedAt)} — {company.suspendedReason}
            </p>
          )}
        </div>
      </header>

      <CompanyModeration
        companyId={company.id}
        companyName={company.name}
        suspended={Boolean(company.suspendedAt)}
        hasOwnerEmail={Boolean(ownerEmail)}
      />

      <section>
        <h3 className="font-display text-xl">
          Reports{" "}
          <span className="text-muted-foreground">
            ({openReports.length} open / {reports.length})
          </span>
        </h3>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No reports.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{r.reason}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.status} · {formatDate(r.createdAt)}
                  </span>
                </div>
                {r.detail && <p className="mt-1 text-muted-foreground">{r.detail}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  by {r.reporterEmail ?? "unknown"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-display text-xl">
          Jobs <span className="text-muted-foreground">({jobs.length})</span>
        </h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-muted/40">
                  <td className="p-3">
                    <Link href={`/jobs/${j.slug}`} className="font-medium hover:underline">
                      {j.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      {j.applicants} applied · {formatDate(j.createdAt)}
                    </span>
                  </td>
                  <td className="p-3 capitalize text-muted-foreground">{j.status}</td>
                  <td className="hidden p-3 text-right tabular-nums sm:table-cell">
                    {j.applicants} applied
                  </td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">
                    {formatDate(j.createdAt)}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                    No jobs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
