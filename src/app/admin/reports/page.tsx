import type { Metadata } from "next";

import { getReportsAdmin } from "@/features/admin/data";
import { ReportsList } from "@/features/admin/components/reports-list";

export const metadata: Metadata = { title: "Admin · Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await getReportsAdmin();
  const open = reports.filter((r) => r.status === "open");

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {open.length} open of {reports.length} total. Resolving a report doesn&apos;t
        change the company — suspend it from its page if needed.
      </p>
      <div className="mt-4">
        <ReportsList reports={reports} />
      </div>
    </div>
  );
}
