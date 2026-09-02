import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Post a job" };

export default function CreateJobPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl">Posting reopens soon</h1>
      <p className="mt-2 text-muted-foreground">
        Recruiter accounts and job posting are coming back in the next release.
      </p>
      <Link href="/jobs" className={`${buttonVariants()} mt-6`}>
        Browse jobs
      </Link>
    </div>
  );
}
