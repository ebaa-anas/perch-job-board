import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link expired", robots: { index: false, follow: false } };

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="font-display text-2xl">That link didn&apos;t work</h1>
      <p className="text-sm text-muted-foreground">
        The confirmation or reset link is invalid or has already been used.
        Request a fresh one and try again.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Back to sign in
        </Link>
        <Link href="/auth/reset" className={buttonVariants()}>
          Send a new link
        </Link>
      </div>
    </div>
  );
}
