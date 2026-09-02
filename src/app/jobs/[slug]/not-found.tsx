import Link from "next/link";
import { SearchX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function JobNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">This job isn&apos;t available</h1>
      <p className="text-sm text-muted-foreground">
        It may have been filled or removed. Browse the board for roles that are
        still open.
      </p>
      <Link href="/jobs" className={buttonVariants()}>
        Back to all jobs
      </Link>
    </div>
  );
}
