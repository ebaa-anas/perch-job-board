"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Mail, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatRelativeDate } from "@/features/jobs/utils";
import {
  changeMemberRole,
  inviteTeamMember,
  removeTeamMember,
  revokeInvite,
  transferOwnership,
} from "@/features/team/actions";
import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_ROLE_DESCRIPTIONS,
  TEAM_ROLE_LABELS,
  can,
  type AssignableTeamRole,
  type TeamRole,
} from "@/features/team/roles";
import type { TeamInvite, TeamMember } from "@/features/team/data";

/**
 * The company team screen.
 *
 * Controls are rendered from the caller's own role, but every action is also
 * refused server-side and by RLS — so hiding a button is a courtesy, not the
 * security model.
 */
export function TeamManager({
  members,
  invites,
  yourRole,
}: {
  members: TeamMember[];
  invites: TeamInvite[];
  yourRole: TeamRole;
}) {
  const manages = can(yourRole, "manage_team");

  return (
    <div className="space-y-10">
      {manages && <InviteForm />}

      <section>
        <h2 className="font-display text-2xl">
          Team <span className="text-muted-foreground">({members.length})</span>
        </h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {members.map((member) => (
            <MemberRow
              key={member.profileId}
              member={member}
              yourRole={yourRole}
            />
          ))}
        </ul>
      </section>

      {manages && invites.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">
            Pending invitations{" "}
            <span className="text-muted-foreground">({invites.length})</span>
          </h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </ul>
        </section>
      )}

      {!manages && (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          You hold a {TEAM_ROLE_LABELS[yourRole].toLowerCase()} seat: you can post
          jobs and work with applicants. Ask an owner or admin to change seats or
          invite someone.
        </p>
      )}
    </div>
  );
}

function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AssignableTeamRole>("recruiter");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSent(null);
    const result = await inviteTeamMember({ email, role });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(email);
    setEmail("");
    router.refresh();
  };

  return (
    <section>
      <h2 className="font-display text-2xl">Invite someone</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        They need a Perch recruiter account on the same email address.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="invite-email"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Email
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            disabled={busy}
          />
        </div>
        <div>
          <label
            htmlFor="invite-role"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Seat
          </label>
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableTeamRole)}
            disabled={busy}
            className="w-auto"
          >
            {ASSIGNABLE_TEAM_ROLES.map((option) => (
              <option key={option} value={option}>
                {TEAM_ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={submit} disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Send invitation
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {TEAM_ROLE_DESCRIPTIONS[role]}
      </p>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {sent && (
        <p className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          Invitation sent to {sent}.
        </p>
      )}
    </section>
  );
}

function MemberRow({
  member,
  yourRole,
}: {
  member: TeamMember;
  yourRole: TeamRole;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isOwner = member.role === "owner";
  const canManage = can(yourRole, "manage_team") && !isOwner;
  const canHandOver =
    can(yourRole, "transfer_ownership") && !isOwner && !member.isYou;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That didn't work.");
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          {member.fullName || "Teammate"}
          {member.isYou && (
            <span className="text-xs font-normal text-muted-foreground">(you)</span>
          )}
          {isOwner && (
            <Badge tone="primary">
              <Crown className="size-3" aria-hidden />
              Owner
            </Badge>
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Joined {formatRelativeDate(member.joinedAt)}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManage ? (
          <Select
            value={member.role}
            onChange={(e) =>
              run(() =>
                changeMemberRole({
                  profileId: member.profileId,
                  role: e.target.value as AssignableTeamRole,
                }),
              )
            }
            disabled={busy}
            aria-label={`Seat for ${member.fullName || "teammate"}`}
            className="h-9 w-auto"
          >
            {ASSIGNABLE_TEAM_ROLES.map((option) => (
              <option key={option} value={option}>
                {TEAM_ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        ) : (
          !isOwner && <Badge tone="outline">{TEAM_ROLE_LABELS[member.role]}</Badge>
        )}

        {canHandOver && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => run(() => transferOwnership(member.profileId))}
          >
            Make owner
          </Button>
        )}

        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Remove ${member.fullName || "teammate"}`}
            onClick={() => run(() => removeTeamMember(member.profileId))}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
}

function InviteRow({ invite }: { invite: TeamInvite }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const revoke = async () => {
    setBusy(true);
    await revokeInvite(invite.id);
    setBusy(false);
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{invite.email}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {TEAM_ROLE_LABELS[invite.role]} ·{" "}
          {invite.expired
            ? "expired"
            : `expires ${formatRelativeDate(invite.expiresAt)}`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={revoke}
        disabled={busy}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Revoke
      </Button>
    </li>
  );
}
