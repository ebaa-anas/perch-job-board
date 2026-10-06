"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDate } from "@/features/jobs/utils";
import { adminDeleteUser } from "@/features/admin/actions";
import type { AdminUserRow } from "@/features/admin/data";

type RoleFilter = "all" | "seeker" | "recruiter" | "admin";

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "seeker", label: "Job seekers" },
  { value: "recruiter", label: "Recruiters" },
  { value: "admin", label: "Admins" },
];

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<RoleFilter>("all");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (role !== "all" && u.role !== role) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      u.email.toLowerCase().includes(t) ||
      (u.fullName ?? "").toLowerCase().includes(t) ||
      (u.role ?? "").includes(t)
    );
  });

  const del = async (u: AdminUserRow) => {
    if (!window.confirm(`Delete ${u.email}? This removes their account and everything they own.`)) {
      return;
    }
    setBusy(u.id);
    setErr(null);
    const r = await adminDeleteUser(u.id);
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Failed.");
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRole(f.value)}
              aria-pressed={role === f.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                role === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Role</th>
              <th className="hidden p-3 font-medium sm:table-cell">Joined</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="max-w-52 p-3 sm:max-w-none">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {u.fullName || u.email}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </td>
                <td className="p-3 capitalize text-muted-foreground">{u.role ?? "—"}</td>
                <td className="hidden p-3 text-muted-foreground sm:table-cell">
                  {formatDate(u.createdAt)}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    disabled={busy !== null}
                    onClick={() => del(u)}
                  >
                    {busy === u.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
