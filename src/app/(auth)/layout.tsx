import type { ReactNode } from "react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";

/**
 * Centered, distraction-light shell for the auth screens. It still nests inside
 * the root layout (site header/footer remain), but pulls the form into a narrow
 * column with the wordmark on top.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link href="/" aria-label="Perch home" className="mx-auto mb-8">
        <Wordmark size={30} />
      </Link>
      {children}
    </div>
  );
}
