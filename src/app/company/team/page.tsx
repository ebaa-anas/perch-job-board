import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { getOwnMembership, getPendingInvites, getTeamMembers } from "@/features/team/data";
import { can } from "@/features/team/roles";
import { TeamManager } from "@/features/team/components/team-manager";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export default async function CompanyTeamPage() {
  await requireRole("recruiter", "/company/team");
  const membership = await getOwnMembership();

  if (!membership) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl">Team</h1>
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-2xl">No company yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your company profile first, then invite the rest of your
            hiring team.
          </p>
          <Link href="/company" className={`${buttonVariants()} mt-4`}>
            Create company profile
          </Link>
        </div>
      </div>
    );
  }

  const [members, invites] = await Promise.all([
    getTeamMembers(membership.companyId),
    // Only a manager can read invites at all; skipping the query for everyone
    // else keeps the page from relying on an RLS denial to look empty.
    can(membership.role, "manage_team")
      ? getPendingInvites(membership.companyId)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Team</h1>
          <p className="mt-1 text-muted-foreground">
            Everyone who can post jobs and review applicants for your company.
          </p>
        </div>
        <Link
          href="/company"
          className="text-sm font-medium text-primary hover:underline"
        >
          Company profile
        </Link>
      </header>

      <TeamManager
        members={members}
        invites={invites}
        yourRole={membership.role}
      />
    </div>
  );
}
