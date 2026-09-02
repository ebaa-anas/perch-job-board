import Link from "next/link";
import { Briefcase } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="size-3.5" />
          </span>
          Perch
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
          <Link href="/jobs" className="hover:text-foreground">
            Browse jobs
          </Link>
          <Link href="/jobs/create" className="hover:text-foreground">
            Post a job
          </Link>
          <Link href="/saved-jobs" className="hover:text-foreground">
            Saved
          </Link>
        </nav>
        <p className="text-muted-foreground">
          A demo built with Next.js &amp; TypeScript.
        </p>
      </div>
    </footer>
  );
}
