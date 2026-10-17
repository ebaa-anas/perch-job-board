import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import { isTeamRole, type AssignableTeamRole, type TeamRole } from "@/features/team/roles";

export interface TeamMember {
  profileId: string;
  fullName: string | null;
  role: TeamRole;
  joinedAt: string;
  isYou: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: AssignableTeamRole;
  expiresAt: string;
  createdAt: string;
  /** True once the clock has passed `expiresAt`; the row is kept for context. */
  expired: boolean;
}

/**
 * The signed-in user's seat, or null if they hold none.
 *
 * This is the single source of truth for which team controls to render.
 * Authorisation itself is the database's — `can_manage_company()` and the
 * redefined `owns_*` helpers in migration 0018 — so a stale read here can
 * only ever show or hide a button, never grant access.
 */
export const getOwnMembership = cache(
  async (): Promise<{ companyId: string; role: TeamRole } | null> => {
    const user = await getUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!data || !isTeamRole(data.role)) return null;
    return { companyId: data.company_id, role: data.role };
  },
);

export const getTeamMembers = cache(
  async (companyId: string): Promise<TeamMember[]> => {
    const user = await getUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("company_members")
      .select("profile_id, role, created_at, profiles ( full_name )")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getTeamMembers]", error);
      return [];
    }

    type Row = {
      profile_id: string;
      role: string;
      created_at: string;
      profiles: { full_name: string | null } | null;
    };

    return (data as unknown as Row[]).map((row) => ({
      profileId: row.profile_id,
      fullName: row.profiles?.full_name ?? null,
      role: isTeamRole(row.role) ? row.role : "recruiter",
      joinedAt: row.created_at,
      isYou: row.profile_id === user?.id,
    }));
  },
);

/** Outstanding invitations. Accepted ones are not shown — they are members now. */
export const getPendingInvites = cache(
  async (companyId: string): Promise<TeamInvite[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("company_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("company_id", companyId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getPendingInvites]", error);
      return [];
    }

    const now = Date.now();
    return (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role === "admin" ? "admin" : "recruiter",
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      expired: new Date(row.expires_at).getTime() < now,
    }));
  },
);

/**
 * The invitation a signed-in user has been sent, looked up by token.
 *
 * Readable because the invitee's own policy on `company_invites` matches on
 * their email — so a token belonging to someone else returns nothing here,
 * and `accept_company_invite()` re-checks the address regardless.
 */
export const getInviteByToken = cache(
  async (
    token: string,
  ): Promise<{ companyName: string; role: AssignableTeamRole } | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_invites")
      .select("role, companies!inner ( name )")
      .eq("token", token)
      .is("accepted_at", null)
      .maybeSingle();

    if (!data) return null;
    const row = data as unknown as { role: string; companies: { name: string } };
    return {
      companyName: row.companies.name,
      role: row.role === "admin" ? "admin" : "recruiter",
    };
  },
);
