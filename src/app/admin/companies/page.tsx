import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Ban } from "lucide-react";

import { getCompaniesAdmin } from "@/features/admin/data";
import { formatDate } from "@/features/jobs/utils";

export const metadata: Metadata = { title: "Admin · Companies" };
export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const companies = await getCompaniesAdmin();

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {companies.length} companies. Open one to view its jobs, applicants,
        reports and to suspend or message it.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Company</th>
              <th className="p-3 font-medium">Owner</th>
              <th className="p-3 font-medium text-right">Jobs</th>
              <th className="p-3 font-medium text-right">Applicants</th>
              <th className="p-3 font-medium text-right">Reports</th>
              <th className="p-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <td className="p-3">
                  <Link
                    href={`/admin/companies/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.suspendedAt && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-red-600 dark:text-red-400">
                      <Ban className="size-3" />
                      Suspended
                    </span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{c.ownerEmail ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">
                  {c.published}/{c.jobs}
                </td>
                <td className="p-3 text-right tabular-nums">{c.applicants}</td>
                <td className="p-3 text-right tabular-nums">
                  {c.openReports > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-highlight">
                      <AlertTriangle className="size-3.5" />
                      {c.openReports}
                    </span>
                  ) : (
                    0
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
