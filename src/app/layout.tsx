import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
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
  const [savedIds, unreadNotifications] = await Promise.all([
    isSeeker ? listSavedJobIds() : Promise.resolve([]),
    profile ? getUnreadNotificationCount() : Promise.resolve(0),
  ]);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
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
