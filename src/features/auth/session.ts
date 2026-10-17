import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/features/auth/admin-emails";

/**
 * Server-only auth/session helpers. Every export is request-scoped: the
 * `React.cache` wrappers memoize the underlying Supabase round-trips for the
 * lifetime of a single render/request so a layout and its pages can each call
 * `getProfile()` without stacking queries.
 *
 * This module reads `cookies()` (via `@/lib/supabase/server`) — never import it
 * into a Client Component.
 */

export type SessionRole = "seeker" | "recruiter" | "admin";

export type SessionProfile = {
  id: string;
  email: string;
  role: SessionRole | null;
  fullName: string | null;
};

/**
 * The currently signed-in Supabase user, or `null` for a guest. A missing or
 * stale session surfaces as an `AuthSessionMissingError`; for route gating that
 * is indistinguishable from "not signed in", so every auth error collapses to
 * `null` rather than throwing.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/**
 * The signed-in user joined to their `profiles` row, or `null` if there is no
 * user (or no profile row yet). `role` is `null` until onboarding picks one.
 */
export const getProfile = cache(async (): Promise<SessionProfile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    email: user.email ?? "",
    role: (data.role as SessionRole | null) ?? null,
    fullName: data.full_name ?? null,
  };
});

/**
 * Require a signed-in user. Redirects to `/login?next=<nextPath>` when there is
 * none; otherwise returns the user.
 */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=" + encodeURIComponent(nextPath ?? "/"));
  }
  return user;
}

/**
 * Require a signed-in user with a specific role. Redirects:
 *   * to `/login?next=…` when signed out,
 *   * to `/onboarding` when the user has not chosen a role yet,
 *   * to `/` when the user's role does not match.
 * Otherwise returns the profile.
 *
 * For `admin` the `profiles.role` column is not enough on its own. It is a
 * cache of `admin_emails`, and a cache goes stale: someone removed from the
 * list keeps the row until their next login, and before migration 0014 the row
 * could be forged at signup. Since everything behind this guard runs on the
 * service-role client, the list itself is re-checked here.
 */
export async function requireRole(
  role: SessionRole,
  nextPath?: string,
): Promise<SessionProfile> {
  await requireUser(nextPath);

  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role == null) redirect("/onboarding");
  if (profile.role !== role) redirect("/");
  if (role === "admin" && !(await isAdminEmail(profile.email))) redirect("/");

  return profile;
}
