import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";

function columns(t: Dictionary): { heading: string; links: { label: string; href: string }[] }[] {
  return [
    {
      heading: t.footer.product,
      links: [
        { label: t.footer.browseJobs, href: "/jobs" },
        { label: t.footer.savedJobs, href: "/saved-jobs" },
      ],
    },
    {
      heading: t.footer.forRecruiters,
      links: [
        { label: t.footer.postJob, href: "/jobs/create" },
        { label: t.footer.companyProfile, href: "/company" },
      ],
    },
    {
      heading: t.footer.company,
      links: [
        { label: t.footer.about, href: "#" },
        { label: t.footer.contact, href: "#" },
      ],
    },
    {
      heading: t.footer.legal,
      links: [
        { label: t.footer.privacy, href: "#" },
        { label: t.footer.terms, href: "#" },
      ],
    },
  ];
}

export async function SiteFooter() {
  const t = getDictionary(await getLocale());

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
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.tagline}</p>
        </div>

        {columns(t).map((col) => (
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
          © {new Date().getFullYear()} Perch. {t.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
