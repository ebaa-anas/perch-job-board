"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { sendTeamInviteEmail } from "@/lib/email";
import { createNotification } from "@/features/notifications/notify";
import { getOwnMembership } from "@/features/team/data";
import { ASSIGNABLE_TEAM_ROLES, can } from "@/features/team/roles";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Team-seat mutations.
 *
 * Each action re-checks the caller's capability before acting, but the real
 * boundary is RLS: `company_members` and `company_invites` are writable only
 * when `can_manage_company()` holds, and joining a team is possible only
 * through the `accept_company_invite()` security-definer function. The checks
 * here exist to return a readable error instead of an empty result set.
 */

/** 32 bytes of url-safe randomness — the invite link is a bearer credential. */
function inviteToken(): string {
  return randomBytes(32).toString("base64url");
}

async function requireManager(): Promise<
  { ok: true; companyId: string } | { ok: false; error: string }
> {
  await requireRole("recruiter");
  const membership = await getOwnMembership();
  if (!membership) {
    return { ok: false, error: "You are not part of a company yet." };
  }
  if (!can(membership.role, "manage_team")) {
    return { ok: false, error: "Only an owner or admin can manage the team." };
  }
  return { ok: true, companyId: membership.companyId };
}

export async function inviteTeamMember(input: {
  email: string;
  role: "admin" | "recruiter";
}): Promise<Result> {
  const profile = await requireRole("recruiter");
  const manager = await requireManager();
  if (!manager.ok) return manager;

  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      role: z.enum(ASSIGNABLE_TEAM_ROLES),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  // Re-inviting the same address replaces the outstanding invite rather than
  // stacking a second one — the partial unique index would reject it anyway,
  // and "resend" is what the manager actually means.
  await supabase
    .from("company_invites")
    .delete()
    .eq("company_id", manager.companyId)
    .eq("email", parsed.data.email)
    .is("accepted_at", null);

  const token = inviteToken();
  const { error } = await supabase.from("company_invites").insert({
    company_id: manager.companyId,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invited_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", manager.companyId)
    .maybeSingle();

  void sendTeamInviteEmail({
    to: parsed.data.email,
    companyName: company?.name ?? "a company",
    invitedByName: profile.fullName ?? profile.email,
    role: parsed.data.role,
    token,
  }).catch((sendError) => {
    console.error("[inviteTeamMember] email failed", sendError);
  });

  revalidatePath("/company/team");
  return { ok: true };
}

export async function revokeInvite(id: string): Promise<Result> {
  const manager = await requireManager();
  if (!manager.ok) return manager;
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("company_invites").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/company/team");
  return { ok: true };
}

export async function changeMemberRole(input: {
  profileId: string;
  role: "admin" | "recruiter";
}): Promise<Result> {
  const manager = await requireManager();
  if (!manager.ok) return manager;

  const parsed = z
    .object({
      profileId: z.string().uuid(),
      role: z.enum(ASSIGNABLE_TEAM_ROLES),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  // The owner row is excluded by the policy's `role <> 'owner'`, so an attempt
  // to demote the owner matches no row rather than succeeding.
  const { error, count } = await supabase
    .from("company_members")
    .update({ role: parsed.data.role }, { count: "exact" })
    .eq("company_id", manager.companyId)
    .eq("profile_id", parsed.data.profileId);

  if (error) return { ok: false, error: error.message };
  if (count === 0) {
    return { ok: false, error: "That member's role can't be changed." };
  }

  revalidatePath("/company/team");
  return { ok: true };
}

export async function removeTeamMember(profileId: string): Promise<Result> {
  const manager = await requireManager();
  if (!manager.ok) return manager;
  if (!z.string().uuid().safeParse(profileId).success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("company_members")
    .delete({ count: "exact" })
    .eq("company_id", manager.companyId)
    .eq("profile_id", profileId);

  if (error) return { ok: false, error: error.message };
  if (count === 0) {
    return { ok: false, error: "That member can't be removed." };
  }

  void createNotification({
    profileId,
    kind: "system",
    title: "You were removed from a company team",
    body: "You no longer have access to that company's jobs and applicants.",
    url: "/dashboard",
  });

  revalidatePath("/company/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Accept an invitation.
 *
 * All the real work is in `accept_company_invite()`, which runs as the
 * definer because the caller is by definition not yet a member and so cannot
 * satisfy any insert policy. It returns a status string; the mapping below
 * turns that into something a person can act on.
 */
const ACCEPT_ERRORS: Record<string, string> = {
  not_signed_in: "Sign in to accept this invitation.",
  not_found: "That invitation link is not valid.",
  already_accepted: "That invitation has already been used.",
  expired: "That invitation has expired. Ask for a new one.",
  wrong_email:
    "That invitation was sent to a different email address. Sign in with that address.",
  not_recruiter:
    "Team seats are for recruiter accounts. This account is registered as a job seeker.",
  already_member: "You are already part of a company team.",
};

export async function acceptInvite(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("recruiter");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_company_invite", {
    p_token: token,
  });

  if (error) {
    console.error("[acceptInvite]", error);
    return { ok: false, error: "Couldn't accept the invitation. Try again." };
  }
  if (data !== "ok") {
    return {
      ok: false,
      error: ACCEPT_ERRORS[String(data)] ?? "Couldn't accept the invitation.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/company");
  return { ok: true };
}

export async function leaveTeam(): Promise<Result> {
  await requireRole("recruiter");
  const membership = await getOwnMembership();
  if (!membership) return { ok: false, error: "You are not part of a company." };
  if (membership.role === "owner") {
    return {
      ok: false,
      error: "Transfer ownership to someone else before leaving.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", membership.companyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

const TRANSFER_ERRORS: Record<string, string> = {
  not_signed_in: "Sign in again to transfer ownership.",
  not_owner: "Only the current owner can transfer ownership.",
  already_owner: "That person already owns the company.",
  not_a_member: "Invite them to the team first.",
};

export async function transferOwnership(profileId: string): Promise<Result> {
  await requireRole("recruiter");
  const membership = await getOwnMembership();
  if (!membership || !can(membership.role, "transfer_ownership")) {
    return { ok: false, error: "Only the current owner can transfer ownership." };
  }
  if (!z.string().uuid().safeParse(profileId).success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_company_ownership", {
    p_company: membership.companyId,
    p_to: profileId,
  });

  if (error) return { ok: false, error: error.message };
  if (data !== "ok") {
    return {
      ok: false,
      error: TRANSFER_ERRORS[String(data)] ?? "Couldn't transfer ownership.",
    };
  }

  void createNotification({
    profileId,
    kind: "system",
    title: "You are now the owner of your company on Perch",
    body: "You can manage billing, the team, and the company profile.",
    url: "/company/team",
  });

  revalidatePath("/company/team");
  return { ok: true };
}
