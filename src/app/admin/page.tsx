import type { Metadata } from "next";
import Link from "next/link";

import { getAdminAnalytics } from "@/features/admin/analytics";
import { AreaChart, BarList } from "@/features/admin/components/charts";

export const metadata: Metadata = { title: "Admin · Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const a = await getAdminAnalytics(30);

  const kpis = [
    { label: "Users", value: a.totals.users, sub: `${a.totals.seekers} seekers · ${a.totals.recruiters} recruiters` },
    { label: "Companies", value: a.totals.companies, sub: `${a.totals.suspendedCompanies} suspended` },
    { label: "Jobs", value: a.totals.jobs, sub: `${a.totals.publishedJobs} live` },
    { label: "Applications", value: a.totals.applications, sub: "all time" },
    { label: "Open reports", value: a.totals.openReports, sub: "need review", href: "/admin/reports" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="font-display text-3xl">{k.value}</p>
              <p className="text-xs font-medium">{k.label}</p>
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{k.sub}</p>
            </>
          );
          return k.href ? (
            <Link
              key={k.label}
              href={k.href}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary"
            >
              {body}
            </Link>
          ) : (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AreaChart points={a.signups} label="New sign-ups" />
        <AreaChart points={a.jobs} label="Jobs posted" accent="var(--color-highlight)" />
        <AreaChart points={a.applications} label="Applications" accent="var(--color-ring)" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarList
          label="Top companies by applicants"
          items={a.topCompanies.map((c) => ({ label: c.name, value: c.applicants }))}
        />
        <BarList
          label="Top companies by jobs"
          items={a.topCompanies
            .slice()
            .sort((x, y) => y.jobs - x.jobs)
            .map((c) => ({ label: c.name, value: c.jobs }))}
        />
      </div>
    </div>
  );
}
