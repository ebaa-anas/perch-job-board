"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/features/auth/components/auth-ui";
import {
  addAdminEmail,
  removeAdminEmail,
  updateOwnPassword,
} from "@/features/admin/actions";
import { adminReseedDemo, adminWipeDemo } from "@/features/admin/actions";

export function SettingsPanel({
  emails,
  selfEmail,
}: {
  emails: string[];
  selfEmail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [newEmail, setNewEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusy(key);
    setErr(null);
    setNote(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Failed.");
      return false;
    }
    setNote(r.message ?? "Done.");
    router.refresh();
    return true;
  };

  return (
    <div className="space-y-8">
      {note && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">{note}</p>
      )}
      {err && <FormError message={err} />}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Admin accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyone signing in with an email on this list becomes an admin.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {emails.map((email) => (
            <li key={email} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                {email}
                {email === selfEmail.toLowerCase() && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </span>
              {email !== selfEmail.toLowerCase() && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  disabled={busy !== null}
                  onClick={() => {
                    if (window.confirm(`Remove admin access for ${email}?`)) {
                      void run("rm" + email, () => removeAdminEmail(email));
                    }
                  }}
                >
                  {busy === "rm" + email ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            type="email"
            placeholder="new-admin@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button
            disabled={busy !== null || !newEmail.trim()}
            onClick={() =>
              run("add", async () => {
                const r = await addAdminEmail(newEmail);
                if (r.ok) setNewEmail("");
                return r;
              })
            }
          >
            {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Change your password</h2>
        <div className="mt-3 flex max-w-sm flex-col gap-2">
          <Input
            type="password"
            placeholder="New password (min 8)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
          <Button
            disabled={busy !== null || pw.length < 8 || pw !== pw2}
            onClick={() =>
              run("pw", async () => {
                const r = await updateOwnPassword(pw);
                if (r.ok) {
                  setPw("");
                  setPw2("");
                }
                return r;
              })
            }
          >
            {busy === "pw" && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
          {pw && pw !== pw2 && (
            <p className="text-xs text-red-600 dark:text-red-400">Passwords don&apos;t match.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Demo data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The 14 seeded companies (no owner) and their jobs.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("reseed", adminReseedDemo)}
          >
            {busy === "reseed" && <Loader2 className="size-4 animate-spin" />}
            Reseed
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm("Remove all demo companies and their jobs?")) {
                void run("wipe", adminWipeDemo);
              }
            }}
          >
            {busy === "wipe" && <Loader2 className="size-4 animate-spin" />}
            Wipe
          </Button>
        </div>
      </section>
    </div>
  );
}
