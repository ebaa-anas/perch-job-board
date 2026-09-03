"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/features/auth/components/auth-ui";
import {
  emailCompany,
  reinstateCompany,
  suspendCompany,
} from "@/features/admin/actions";

export function CompanyModeration({
  companyId,
  companyName,
  suspended,
  hasOwnerEmail,
}: {
  companyId: string;
  companyName: string;
  suspended: boolean;
  hasOwnerEmail: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [reason, setReason] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [emailOpen, setEmailOpen] = React.useState(false);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusy(key);
    setErr(null);
    setNote(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Failed.");
      return;
    }
    setNote(r.message ?? "Done.");
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Moderation</h3>
      {note && (
        <p className="mt-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {note}
        </p>
      )}
      {err && <div className="mt-2"><FormError message={err} /></div>}

      <div className="mt-4 space-y-4">
        {suspended ? (
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("reinstate", () => reinstateCompany(companyId))}
          >
            {busy === "reinstate" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Reinstate — allow posting again
          </Button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Reason for suspension (shown to the company)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              className="shrink-0 text-red-600 hover:bg-red-500/10 dark:text-red-400"
              disabled={busy !== null || reason.trim().length < 3}
              onClick={() => run("suspend", () => suspendCompany(companyId, reason))}
            >
              {busy === "suspend" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Suspend
            </Button>
          </div>
        )}

        <div>
          <Button
            variant="outline"
            disabled={!hasOwnerEmail}
            onClick={() => setEmailOpen((v) => !v)}
          >
            <Mail className="size-4" />
            {hasOwnerEmail ? "Email the company owner" : "Owner has no email"}
          </Button>
          {emailOpen && hasOwnerEmail && (
            <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <Textarea
                rows={5}
                placeholder={`Message to ${companyName}…`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button
                disabled={busy !== null || subject.trim().length < 3 || body.trim().length < 10}
                onClick={() =>
                  run("email", async () => {
                    const r = await emailCompany({ companyId, subject, body });
                    if (r.ok) {
                      setSubject("");
                      setBody("");
                      setEmailOpen(false);
                    }
                    return r;
                  })
                }
              >
                {busy === "email" && <Loader2 className="size-4 animate-spin" />}
                Send
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
