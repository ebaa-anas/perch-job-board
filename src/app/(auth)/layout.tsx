import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Centered, distraction-light shell for the auth screens. It still nests inside
 * the root layout (site header/footer remain), but pulls the form into a narrow
 * column with the wordmark on top. Dispatch B swaps the text mark for <Wordmark/>.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="font-display mx-auto mb-8 text-2xl tracking-tight"
      >
        Perch
      </Link>
      {children}
    </div>
  );
}
