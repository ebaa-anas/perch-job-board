"use client";

import * as React from "react";
import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/features/auth/components/auth-ui";
import { reportCompany } from "@/features/companies/actions";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/features/companies/schema";

export function ReportCompanyButton({
  companyId,
  companySlug,
  canReport,
}: {
  companyId: string;
  companySlug: string;
  canReport: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  if (!canReport) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/companies/${companySlug}`)}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Flag className="size-3.5" />
        Report this company
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Flag className="size-3.5" />
        Report this company
      </button>
      {open && (
        <ReportDialog companyId={companyId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ReportDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState<ReportReason>("spam");
  const [detail, setDetail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await reportCompany(companyId, { reason, detail });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Failed.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Report this company"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        {done ? (
          <div className="space-y-3 text-center">
            <h2 className="font-display text-xl">Thanks — report received</h2>
            <p className="text-sm text-muted-foreground">
              An admin will take a look. You won&apos;t hear back directly.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl">Report this company</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us what&apos;s wrong. One report per company.
            </p>
            <div className="mt-4 space-y-3">
              {error && <FormError message={error} />}
              <div className="space-y-1.5">
                <label htmlFor="report-reason" className="text-sm font-medium">
                  Reason
                </label>
                <Select
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REPORT_REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="report-detail" className="text-sm font-medium">
                  Details <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="report-detail"
                  rows={4}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="What happened?"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Submit report
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
