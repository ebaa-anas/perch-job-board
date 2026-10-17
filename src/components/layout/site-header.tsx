"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, Menu, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSavedJobs } from "@/features/saved-jobs/saved-jobs-provider";
import type { SessionProfile } from "@/features/auth/session";

export function SiteHeader({
  profile,
  unreadNotifications = 0,
}: {
  profile: SessionProfile | null;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { count, hydrated } = useSavedJobs();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [seenPath, setSeenPath] = React.useState(pathname);

  // Close the mobile menu on navigation (state adjusted during render, not in an effect).
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setMenuOpen(false);
  }

  const role = profile?.role ?? null;
  const isSeeker = role === "seeker";
  const isAuthed = profile != null;

  const nav: { href: string; label: string }[] = [
    { href: "/jobs", label: t.nav.browseJobs },
  ];
  if (isAuthed && role) nav.push({ href: "/dashboard", label: t.nav.dashboard });
  if (isSeeker) nav.push({ href: "/saved-jobs", label: t.nav.saved });
  if (isSeeker) nav.push({ href: "/alerts", label: t.nav.alerts });
  if (role === "recruiter") nav.push({ href: "/company", label: t.nav.company });
  if (role === "admin") nav.push({ href: "/admin", label: t.nav.admin });

  const isActive = (href: string) =>
    href === "/jobs"
      ? pathname.startsWith("/jobs") && pathname !== "/jobs/create"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label="Perch home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.href === "/saved-jobs" && hydrated && count > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                    {count}
                  </span>
                )}
              </span>
              {isActive(item.href) && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {isSeeker && (
            <Link
              href="/saved-jobs"
              aria-label={t.nav.savedJobsAria}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "relative sm:hidden",
              )}
            >
              <Bookmark className="size-[1.15rem]" />
              {hydrated && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          )}

          {isAuthed && (
            <Link
              href="/notifications"
              aria-label={t.nav.notificationsAria}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "relative",
              )}
            >
              <Bell className="size-[1.15rem]" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
          )}

          {/* Signed in, a phone bar already carries saved, alerts, account and
              the menu; the language switch moves into the menu so a 360px
              screen does not scroll sideways. */}
          <div className={cn("items-center", nav.length > 1 ? "hidden sm:flex" : "flex")}>
            <LocaleToggle />
          </div>
          <ThemeToggle />

          {isAuthed ? (
            <UserMenu
              name={profile.fullName}
              email={profile.email}
              role={role ?? "seeker"}
            />
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ size: "sm", className: "px-3" })}
            >
              {t.common.logIn}
            </Link>
          )}

            {/* Only when it holds something: signed out, `nav` is a single
                link the hero already surfaces. */}
            {nav.length > 1 && (
            <button
              type="button"
              aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "sm:hidden",
              )}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            )}
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-background px-4 py-3 sm:hidden">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                  {item.href === "/saved-jobs" && hydrated && count > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border px-3 pt-3">
            <span className="text-sm font-medium text-muted-foreground">{t.nav.language}</span>
            <LocaleToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
