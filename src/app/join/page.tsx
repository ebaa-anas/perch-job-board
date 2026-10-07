import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getProfile, requireUser } from "@/features/auth/session";
import { getInviteByToken, getOwnMembership } from "@/features/team/data";
import { AcceptInvite } from "@/features/team/components/accept-invite";

export const metadata: Metadata = {
  title: "Join a team",
  robots: { index: false, follow: false },
};

/**
 * Invitation landing page.
 *
 * Lives at the top level, deliberately outside `/company`: that segment's
 * layout requires a recruiter role, so an invitee arriving signed out or on a
 * seeker account would be bounced to the home page with no explanation.
 * `requireUser` sends them through login and back here with the token intact,
 * and every other wrong-account case is spelled out below.
 */
export default async function JoinTeamPage({
  searchParams,
}: PageProps<"/join">) {
  const { token } = await searchParams;
  const inviteToken = typeof token === "string" ? token : "";

  if (!inviteToken) {
    return <Shell title="Invitation link is incomplete" />;
  }

  await requireUser(`/join?token=${encodeURIComponent(inviteToken)}`);
  const profile = await getProfile();

  if (!profile?.role) redirect("/onboarding");

  if (profile.role !== "recruiter") {
    return (
      <Shell title="This invitation needs a recruiter account">
        Team seats are for recruiter accounts, and this one is registered as a{" "}
        {profile.role === "admin" ? "an administrator" : "job seeker"}. Ask
        whoever invited you to send it to a recruiter account instead.
      </Shell>
    );
  }

  const membership = await getOwnMembership();
  if (membership) {
    return (
      <Shell title="You are already on a team">
        A Perch account can hold one company seat at a time. Leave your current
        team before joining another.
      </Shell>
    );
  }

  const invite = await getInviteByToken(inviteToken);
  if (!invite) {
    return (
      <Shell title="That invitation is not available">
        It may have been revoked, already used, or sent to a different email
        address than the one you are signed in with.
      </Shell>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <AcceptInvite
        token={inviteToken}
        companyName={invite.companyName}
        role={invite.role}
      />
    </div>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl">{title}</h1>
        {children && (
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {children}
          </p>
        )}
        <Link href="/dashboard" className={`${buttonVariants()} mt-5`}>
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}
