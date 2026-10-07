"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/features/auth/session";
import { isAdminEmail } from "@/features/auth/admin-emails";
import { AUTH_ROLES, type AuthRole } from "@/features/auth/schema";
import { safeRelativePath } from "@/features/auth/redirect";

/**
 * Server Actions for the auth flow. Everything a form or route needs to sign a
 * user up / in / out, run onboarding, and reset a password. Google OAuth is
 * wired but degrades to a friendly message when the provider isn't provisioned.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type OnboardingRole = AuthRole;

/** A `"use server"` action can be called with any argument shape — never trust
 * the compile-time type. Returns the value only when it is a real signup role
 * ("seeker" | "recruiter"), never "admin". */
function asOnboardingRole(value: unknown): OnboardingRole | null {
  return typeof value === "string" && (AUTH_ROLES as readonly string[]).includes(value)
    ? (value as OnboardingRole)
    : null;
}

// ---------------------------------------------------------------------------
// helpers (exported — reused by the auth pages and the /auth/callback route)
// ---------------------------------------------------------------------------

/**
 * Return `next` only when it is a safe same-origin path. All `"use server"`
 * exports must be async; the real logic lives in the pure, testable
 * `safeRelativePath` (blocks `//`, `/\`, schemes, and control-char smuggling).
 */
export async function safeNext(next?: string | null): Promise<string | null> {
  return safeRelativePath(next);
}

/** Post-auth destination: the dashboard once a role is set, else onboarding. */
export async function destForRole(): Promise<string> {
  const profile = await getProfile();
  return profile?.role ? "/dashboard" : "/onboarding";
}

/**
 * Reconcile the signed-in user's `admin` role with `admin_emails`, in both
 * directions.
 *
 * Promotion alone left a one-way door: someone removed from `admin_emails` kept
 * `profiles.role = 'admin'` forever, because nothing ever wrote it back. Taking
 * an admin's access away meant editing the list *and* remembering to fix the
 * row by hand. Now a login settles it either way.
 *
 * Demotion sets NULL rather than 'seeker' so the next request lands in
 * onboarding and the person chooses, instead of this function picking for them.
 *
 * Runs with the service-role client: `admin_emails` has no RLS read policy, and
 * the write has to get past both the "update own profile" policy and the 0003
 * role-immutability trigger, which lets `service_role` through by design.
 *
 * `requireRole('admin')` re-checks the same list on every admin request, so a
 * removal takes effect immediately rather than waiting for the next login.
 */
export async function maybeUpgradeAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const admin = createAdminClient();
  const listed = await isAdminEmail(user.email);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return;

  if (listed && profile.role !== "admin") {
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
    return;
  }
  if (!listed && profile.role === "admin") {
    await admin.from("profiles").update({ role: null }).eq("id", user.id);
  }
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  role: OnboardingRole;
}): Promise<{ ok: true; needsConfirmation: boolean } | { error: string }> {
  const role = asOnboardingRole(input.role);
  if (!role) return { error: "Choose whether you're looking for work or hiring." };
  if (!input.email || !input.password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName, role },
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  // No session means email confirmation is on and a link was sent.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) return { error: friendlyAuthError(error.message) };

  await maybeUpgradeAdmin();
  redirect((await safeNext(input.next)) ?? (await destForRole()));
}

export async function signInWithGoogle(
  next?: string,
): Promise<{ url: string } | { error: string }> {
  const notConfigured = { error: "Google sign-in is not configured yet." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next ?? "")}`,
      },
    });
    if (error) {
      return isProviderDisabled(error.message)
        ? notConfigured
        : { error: friendlyAuthError(error.message) };
    }
    if (!data?.url) return notConfigured;
    return { url: data.url };
  } catch {
    return notConfigured;
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function completeOnboarding(
  roleInput: OnboardingRole,
): Promise<{ error: string } | void> {
  const role = asOnboardingRole(roleInput);
  if (!role) return { error: "Pick how you'll use Perch to continue." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // `.is("role", null)` makes this one-shot: a user can set their role once and
  // can never flip it (or self-promote) afterwards. `role` is already narrowed
  // to seeker|recruiter above, so "admin" can never land here.
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", user.id)
    .is("role", null);
  if (error) return { error: friendlyAuthError(error.message) };

  redirect("/dashboard");
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true }> {
  try {
    const supabase = await createClient();
    // Land on the callback so the PKCE code is exchanged for a (recovery)
    // session, then bounce to /auth/reset which shows the new-password form.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/auth/reset`,
    });
  } catch {
    // Swallow — never reveal whether an address is registered.
  }
  return { ok: true };
}

export async function updatePassword(
  password: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/login");
}

// ---------------------------------------------------------------------------
// error mapping (module-private)
// ---------------------------------------------------------------------------

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address first, then sign in.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with that email already exists — try signing in.";
  }
  if (m.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (
    m.includes("unable to validate email address") ||
    m.includes("email address") && m.includes("invalid") ||
    m.includes("email_address_invalid")
  ) {
    return "That email address looks invalid.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New sign-ups are currently closed.";
  }
  if (m.includes("sending confirmation email") || m.includes("error sending")) {
    return "We couldn't send the confirmation email. Try again shortly.";
  }
  if (
    (m.includes("email") && m.includes("rate limit")) ||
    m.includes("over_email_send_rate_limit")
  ) {
    return "The email service is rate-limited right now, so we can't send a confirmation link. Please try again in a little while.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts. Please wait a bit and try again.";
  }
  if (m.includes("new password should be different")) {
    return "Your new password must be different from the old one.";
  }
  return "Something went wrong. Please try again.";
}

function isProviderDisabled(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("provider is not enabled") ||
    m.includes("is not enabled") ||
    m.includes("unsupported provider") ||
    m.includes("provider not found") ||
    m.includes("oauth provider")
  );
}
