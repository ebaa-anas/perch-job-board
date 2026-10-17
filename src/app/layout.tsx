import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Hanken_Grotesk,
} from "next/font/google";

import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SavedJobsProvider } from "@/features/saved-jobs/saved-jobs-provider";
import { getProfile } from "@/features/auth/session";
import { getUnreadNotificationCount } from "@/features/notifications/data";
import { listSavedJobIds } from "@/features/saved-jobs/actions";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { getLocale } from "@/lib/i18n/locale";
import { DemoBanner } from "@/features/demo/components/demo-banner";
import { DEMO_BANNER_COOKIE, isDemoMode, isDemoUser } from "@/features/demo/demo-rules";

/**
 * Typography.
 *
 * `latin-ext` is not optional here: Turkish needs it for g-breve, s-cedilla
 * and dotless/dotted i. With only `latin`, those glyphs fall back to a system
 * serif mid-word on the TR locale, which reads as subtly broken without being
 * obviously wrong.
 */

/**
 * Body and UI — a humanist grotesque.
 *
 * Warm without being cute: open apertures and a true humanist skeleton, so it
 * stays friendly at 14px in a job card. Avoids both ends of the default
 * spectrum — the rounded geometrics (Poppins, Figtree, DM Sans) that read as
 * template output, and the neutral grotesques (Inter, Geist) that read as
 * nothing at all.
 */
const bodyFont = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const codeFont = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * Display headings — no serif.
 *
 * Three serifs were tried here and each failed differently: Instrument Serif
 * was thin and harsh at size, Fraunces read as a landing-page default, Source
 * Serif 4 as plain. The common factor is that a serif at 36px+ is doing a lot
 * of talking, and on a dense, bilingual product it mostly adds friction.
 *
 * Bricolage Grotesque is an editorial grotesque with deliberate irregularity
 * in its curves and terminals. It carries character at display sizes the way
 * a serif would, but shares a skeleton with the body face, so headings and
 * text feel like one voice rather than two. Its optical-size axis also means
 * it genuinely redraws between a phone and a desktop instead of just scaling.
 */
const displayFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "Perch";
const DESCRIPTION =
  "A two-sided job board for product, design and engineering. Browse and apply as a seeker, or post roles and review applicants as a recruiter.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Perch — Find where you land next",
    template: "%s · Perch",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "job board",
    "jobs",
    "hiring",
    "recruiting",
    "engineering jobs",
    "design jobs",
    "product jobs",
    "remote jobs",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Perch — Find where you land next",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Perch — Find where you land next",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  const isSeeker = profile?.role === "seeker";
  const canSave = !profile || profile.role === "seeker";
  const [savedIds, unreadNotifications, cookieStore] = await Promise.all([
    isSeeker ? listSavedJobIds() : Promise.resolve([]),
    profile ? getUnreadNotificationCount() : Promise.resolve(0),
    cookies(),
  ]);
  const showDemoBanner =
    isDemoMode() &&
    isDemoUser(profile?.email) &&
    cookieStore.get(DEMO_BANNER_COOKIE)?.value !== "dismissed";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${bodyFont.variable} ${codeFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background text-foreground">
        <LocaleProvider initialLocale={locale}>
          <ThemeProvider>
            <SavedJobsProvider
              authedSeeker={isSeeker}
              serverIds={savedIds}
              canSave={canSave}
            >
              {showDemoBanner ? <DemoBanner /> : null}
              <SiteHeader
                profile={profile}
                unreadNotifications={unreadNotifications}
              />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </SavedJobsProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
