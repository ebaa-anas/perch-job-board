"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">Couldn&apos;t load jobs</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong while fetching the job list. This is usually
        temporary.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
