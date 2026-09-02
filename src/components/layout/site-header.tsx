"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useSavedJobs } from "@/features/saved-jobs/saved-jobs-provider";
import type { SessionProfile } from "@/features/auth/session";

export function SiteHeader({ profile }: { profile: SessionProfile | null }) {
  const pathname = usePathname();
  const { count, hydrated } = useSavedJobs();

  const role = profile?.role ?? null;
  const isSeeker = role === "seeker";
  const isAuthed = profile != null;

  const nav: { href: string; label: string }[] = [
    { href: "/jobs", label: "Browse jobs" },
  ];
  if (isAuthed && role) nav.push({ href: "/dashboard", label: "Dashboard" });
  if (isSeeker) nav.push({ href: "/saved-jobs", label: "Saved" });
  if (role === "recruiter") nav.push({ href: "/company", label: "Company" });
  if (role === "admin") nav.push({ href: "/admin", label: "Admin" });

  const isActive = (href: string) =>
    href === "/jobs"
      ? pathname.startsWith("/jobs") && pathname !== "/jobs/create"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Perch home">
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
              aria-label="Saved jobs"
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

          <ThemeToggle />

          {isAuthed ? (
            <UserMenu
              name={profile.fullName}
              email={profile.email}
              role={role ?? "seeker"}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={buttonVariants({ size: "sm" })}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
