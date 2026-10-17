import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/features/auth/session";
import { getOwnFunnelReport } from "@/features/analytics/data";
import {
  FunnelSummary,
  FunnelTable,
  StageBreakdown,
} from "@/features/analytics/components/funnel-table";

export const metadata: Metadata = {
  title: "Hiring analytics",
  robots: { index: false, follow: false },
};

export default async function AnalyticsPage() {
  await requireRole("recruiter", "/dashboard/analytics");
  const { rows, overall } = await getOwnFunnelReport();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Hiring analytics</h1>
          <p className="mt-1 text-muted-foreground">
            How your posts are performing, and how quickly your team replies.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
      </header>

      <FunnelSummary overall={overall} />

      {overall.awaiting > 0 && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong className="font-medium">
            {overall.awaiting}{" "}
            {overall.awaiting === 1 ? "person has" : "people have"} applied and
            not heard back.
          </strong>{" "}
          Your reply rate is shown publicly on your company profile, so this is
          the number candidates see too.
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl">Where candidates are</h2>
        <div className="mt-3">
          <StageBreakdown overall={overall} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">By job</h2>
        <div className="mt-3">
          <FunnelTable rows={rows} />
        </div>
      </section>
    </div>
  );
}
