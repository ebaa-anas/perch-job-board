"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/features/jobs/utils";
import { REPORT_REASON_LABELS } from "@/features/companies/schema";
import { resolveReport } from "@/features/admin/actions";
import type { AdminReportRow } from "@/features/admin/data";

const FILTERS = ["open", "reviewed", "dismissed", "all"] as const;

export function ReportsList({ reports }: { reports: AdminReportRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("open");
  const [busy, setBusy] = React.useState<string | null>(null);

  const shown = reports.filter((r) => filter === "all" || r.status === filter);

  const act = async (id: string, status: "reviewed" | "dismissed" | "open") => {
    setBusy(id + status);
    await resolveReport(id, status);
    setBusy(null);
    router.refresh();
  };

  return (
    <>
      <div className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors",
              filter === f
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link
                  href={`/admin/companies/${r.companyId}`}
                  className="font-medium hover:underline"
                >
                  {r.companyName}
                </Link>
                <span className="ml-2 text-muted-foreground">
                  {REPORT_REASON_LABELS[r.reason]}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  r.status === "open"
                    ? "bg-highlight/15 text-highlight"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {r.status}
              </span>
            </div>
            {r.detail && <p className="mt-2 text-muted-foreground">{r.detail}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              by {r.reporterEmail ?? "unknown"} · {formatDate(r.createdAt)}
            </p>
            {r.status === "open" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(r.id, "reviewed")}>
                  {busy === r.id + "reviewed" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Mark reviewed
                </Button>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(r.id, "dismissed")}>
                  {busy === r.id + "dismissed" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                  Dismiss
                </Button>
              </div>
            )}
            {r.status !== "open" && (
              <button
                type="button"
                onClick={() => act(r.id, "open")}
                disabled={busy !== null}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Reopen
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing here.
          </li>
        )}
      </ul>
    </>
  );
}
