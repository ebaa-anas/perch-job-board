"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/features/jobs/utils";
import { adminDeleteUser } from "@/features/admin/actions";
import type { AdminUserRow } from "@/features/admin/data";

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const filtered = users.filter((u) => {
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
      <Input
        placeholder="Filter by email, name or role…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
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
                  <span className="block truncate font-medium">
                    {u.fullName || u.email}
                  </span>
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
