"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/jobs/utils";
import {
  adminDeleteJob,
  adminDeleteUser,
  adminReseedDemo,
  adminWipeDemo,
} from "@/features/admin/actions";
import type { AdminJobRow, AdminUserRow } from "@/features/admin/data";

type Tab = "jobs" | "users" | "demo";

export function AdminConsole({
  jobs,
  users,
}: {
  jobs: AdminJobRow[];
  users: AdminUserRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("jobs");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusyId(key);
    setNote(null);
    const result = await fn();
    setBusyId(null);
    setNote(result.ok ? result.message ?? "Done." : result.error ?? "Failed.");
    if (result.ok) router.refresh();
  };

  return (
    <div className="mt-8">
      <div className="flex gap-1 border-b border-border">
        {(["jobs", "users", "demo"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "demo" ? "Demo data" : t}
          </button>
        ))}
      </div>

      {note && (
        <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {note}
        </p>
      )}

      {tab === "jobs" && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{job.title}</span>
                <span className="block truncate text-muted-foreground">
                  {job.companyName} · {job.status} · {formatDate(job.createdAt)}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
                disabled={busyId !== null}
                onClick={() => {
                  if (window.confirm(`Delete "${job.title}"?`)) {
                    void act(job.id, () => adminDeleteJob(job.id));
                  }
                }}
              >
                {busyId === job.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </li>
          ))}
          {jobs.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">No jobs.</li>
          )}
        </ul>
      )}

      {tab === "users" && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {user.fullName || user.email}
                </span>
                <span className="block truncate text-muted-foreground">
                  {user.email} · {user.role ?? "no role"} ·{" "}
                  {formatDate(user.createdAt)}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
                disabled={busyId !== null}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${user.email}? This removes their account and everything they own.`,
                    )
                  ) {
                    void act(user.id, () => adminDeleteUser(user.id));
                  }
                }}
              >
                {busyId === user.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {tab === "demo" && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-6 text-sm">
          <p className="text-muted-foreground">
            The demo dataset is the 14 seeded companies (no owner) and their
            jobs. Wiping removes them and anything attached; reseeding restores
            them.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busyId !== null}
              onClick={() => void act("reseed", adminReseedDemo)}
            >
              {busyId === "reseed" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Reseed demo data
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
              disabled={busyId !== null}
              onClick={() => {
                if (window.confirm("Remove all demo companies and their jobs?")) {
                  void act("wipe", adminWipeDemo);
                }
              }}
            >
              {busyId === "wipe" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Wipe demo data
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
