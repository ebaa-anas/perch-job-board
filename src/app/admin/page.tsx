import type { Metadata } from "next";

import {
  getAdminOverview,
  getAllJobsAdmin,
  getAllUsersAdmin,
} from "@/features/admin/data";
import { AdminConsole } from "@/features/admin/components/admin-console";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [overview, jobs, users] = await Promise.all([
    getAdminOverview(),
    getAllJobsAdmin(),
    getAllUsersAdmin(),
  ]);

  const stats = [
    { label: "Users", value: overview.users },
    { label: "Companies", value: overview.companies },
    { label: "Jobs", value: overview.jobs },
    { label: "Published", value: overview.publishedJobs },
    { label: "Applications", value: overview.applications },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">Admin</h1>
      <p className="mt-1 text-muted-foreground">
        Moderation tools. Deletions are permanent and cascade.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4 text-center shadow-sm"
          >
            <p className="font-display text-2xl">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <AdminConsole jobs={jobs} users={users} />
    </div>
  );
}
