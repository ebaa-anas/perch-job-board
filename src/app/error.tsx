"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Segment boundary for every route that doesn't bring its own `error.tsx`.
 *
 * Without this, a failed data fetch anywhere outside `/jobs` fell all the way
 * through to `global-error.tsx` — which replaces <html>, so the visitor lost the
 * header, the footer and their theme, and the response went out as a bare 500.
 * The landing page made that easy to hit: it reads jobs on render, so a database
 * that is merely unreachable took the whole site down rather than one section.
 *
 * Rendering here instead keeps the chrome and leaves a way out of the dead end.
 * `global-error.tsx` stays as the last resort for failures in the root layout
 * itself, which this cannot catch.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load this page. It&apos;s usually temporary — trying
        again often works.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
          Browse jobs
        </Link>
      </div>
    </div>
  );
}
