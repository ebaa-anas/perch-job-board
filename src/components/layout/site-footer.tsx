import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Browse jobs", href: "/jobs" },
      { label: "Saved jobs", href: "/saved-jobs" },
    ],
  },
  {
    heading: "For recruiters",
    links: [
      { label: "Post a job", href: "/jobs/create" },
      { label: "Company profile", href: "/company" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-lg tracking-tight"
          >
            <Logo size={26} />
            Perch
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Where people find where they land next — and where teams find who
            lands with them.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {col.heading}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Perch. Built with Next.js &amp; TypeScript.
        </div>
      </div>
    </footer>
  );
}
