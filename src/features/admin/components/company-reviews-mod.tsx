"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/jobs/utils";
import { Stars } from "@/features/companies/components/stars";
import {
  adminDeleteReview,
  adminSetReviewStatus,
} from "@/features/admin/actions";
import type { AdminReviewRow } from "@/features/admin/data";

export function CompanyReviewsMod({ reviews }: { reviews: AdminReviewRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ ok: boolean }>) => {
    setBusy(key);
    await fn();
    setBusy(null);
    router.refresh();
  };

  const avg =
    reviews.filter((r) => r.status === "visible").length > 0
      ? reviews
          .filter((r) => r.status === "visible")
          .reduce((s, r) => s + r.rating, 0) /
        reviews.filter((r) => r.status === "visible").length
      : null;

  return (
    <section>
      <h3 className="font-display text-xl">
        Reviews{" "}
        <span className="text-muted-foreground">
          ({reviews.length}
          {avg != null ? ` · ${avg.toFixed(1)}★` : ""})
        </span>
      </h3>
      {reviews.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No reviews.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  {r.title && <span className="font-medium">{r.title}</span>}
                  {r.status === "hidden" && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                      hidden
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.reviewerEmail ?? "unknown"} · {formatDate(r.createdAt)}
                </span>
              </div>
              {r.body && (
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {r.body}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    run(r.id + "s", () =>
                      adminSetReviewStatus(
                        r.id,
                        r.status === "visible" ? "hidden" : "visible",
                      ),
                    )
                  }
                >
                  {busy === r.id + "s" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : r.status === "visible" ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {r.status === "visible" ? "Hide" : "Unhide"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  disabled={busy !== null}
                  onClick={() => {
                    if (window.confirm("Delete this review?")) {
                      void run(r.id + "d", () => adminDeleteReview(r.id));
                    }
                  }}
                >
                  {busy === r.id + "d" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
