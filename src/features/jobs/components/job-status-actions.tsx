"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { deleteJob, setJobStatus } from "@/features/jobs/actions";
import { duplicateJob } from "@/features/jobs/import-actions";
import type { Job } from "@/features/jobs/types";

export function JobStatusActions({
  jobId,
  slug,
  status,
}: {
  jobId: string;
  slug: string;
  status: Job["status"];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setPending(label);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  };

  const onDelete = () => {
    if (!window.confirm("Delete this job? This can't be undone.")) return;
    void run("delete", () => deleteJob(jobId));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "published" && (
        <Link
          href={`/jobs/${slug}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          View
        </Link>
      )}

      <Link
        href={`/dashboard/jobs/${jobId}/edit`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Edit
      </Link>

      {/* Reposting a closed role is the common case; the copy lands as a
          draft so dates and salary can be revised before it goes live. */}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending !== null}
        onClick={() =>
          run("duplicate", async () => {
            const result = await duplicateJob(jobId);
            if (result.ok) router.push(`/dashboard/jobs/${result.id}/edit`);
            return result;
          })
        }
      >
        {pending === "duplicate" && <Loader2 className="size-4 animate-spin" />}
        Duplicate
      </Button>

      {status !== "published" && (
        <Button
          size="sm"
          disabled={pending !== null}
          onClick={() => run("publish", () => setJobStatus(jobId, "published"))}
        >
          {pending === "publish" && <Loader2 className="size-4 animate-spin" />}
          {status === "closed" ? "Reopen" : "Publish"}
        </Button>
      )}

      {status === "published" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => run("close", () => setJobStatus(jobId, "closed"))}
        >
          {pending === "close" && <Loader2 className="size-4 animate-spin" />}
          Close
        </Button>
      )}

      {status !== "published" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending !== null}
          onClick={onDelete}
          className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          {pending === "delete" && <Loader2 className="size-4 animate-spin" />}
          Delete
        </Button>
      )}

      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
