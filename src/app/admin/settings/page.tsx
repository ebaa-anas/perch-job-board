import type { Metadata } from "next";

import { getAdminEmails, getAuditLog } from "@/features/admin/data";
import { getUser } from "@/features/auth/session";
import { SettingsPanel } from "@/features/admin/components/settings-panel";
import { formatDate } from "@/features/jobs/utils";

export const metadata: Metadata = { title: "Admin · Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [emails, audit, user] = await Promise.all([
    getAdminEmails(),
    getAuditLog(40),
    getUser(),
  ]);

  return (
    <div className="space-y-10">
      <SettingsPanel emails={emails} selfEmail={user?.email ?? ""} />

      <section>
        <h2 className="font-display text-xl">Recent admin activity</h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-sm">
          {audit.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{e.actorEmail ?? "system"}</span>{" "}
                <span className="text-muted-foreground">{e.action}</span>
                {e.targetId && (
                  <span className="text-muted-foreground"> · {e.targetId}</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(e.createdAt)}
              </span>
            </li>
          ))}
          {audit.length === 0 && (
            <li className="p-4 text-center text-muted-foreground">No activity yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
