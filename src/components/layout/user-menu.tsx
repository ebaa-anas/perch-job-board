"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutDashboard, LogOut, Shield } from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials } from "@/features/jobs/utils";
import { signOut } from "@/features/auth/actions";
import type { SessionRole } from "@/features/auth/session";

type MenuLink = { href: string; label: string; icon: typeof FileText };

const LINKS_BY_ROLE: Record<SessionRole, MenuLink[]> = {
  seeker: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/profile", label: "Your profile", icon: FileText },
  ],
  recruiter: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/company", label: "Company profile", icon: Building2 },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin", label: "Admin", icon: Shield },
  ],
};

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string | null;
  email: string;
  role: SessionRole;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = React.useState(pathname);

  // Close the menu on navigation — adjust state during render (not in an effect)
  // so it's applied before paint and doesn't trigger a cascading re-render.
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const label = name?.trim() || email;
  const initials = getInitials(name?.trim() || email) || email[0]?.toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        {initials}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {role}
              </p>
            </div>
            <div className="my-1 h-px bg-border" />
            {LINKS_BY_ROLE[role].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted",
                )}
              >
                <link.icon className="size-4 text-muted-foreground" />
                {link.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-border" />
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
