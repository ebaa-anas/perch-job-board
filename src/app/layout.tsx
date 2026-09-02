import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SavedJobsProvider } from "@/features/saved-jobs/saved-jobs-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Perch — Find where you land next",
    template: "%s · Perch",
  },
  description:
    "A modern job board where you can browse, filter, save, and post job opportunities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <SavedJobsProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </SavedJobsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
