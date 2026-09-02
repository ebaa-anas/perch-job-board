import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { JobForm } from "@/features/jobs/components/job-form";

export const metadata: Metadata = {
  title: "Post a job",
  description: "Publish a new role to the Perch job board.",
};

export default function CreateJobPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All jobs
      </Link>
      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-4xl">Post a job</h1>
        <p className="mt-1 text-muted-foreground">
          Fill in the details below. The role goes live on the board as soon as
          you publish.
        </p>
      </header>
      <div className="mt-8">
        <JobForm />
      </div>
    </div>
  );
}
