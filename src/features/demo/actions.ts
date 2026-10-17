"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { rateLimitRequest } from "@/lib/rate-limit";
import { DEMO_ACCOUNTS, isDemoMode, isDemoRole } from "@/features/demo/demo-rules";
import {
  demoPassword,
  demoStrings,
  restoreDemoPassword,
} from "@/features/demo/server";

/**
 * One-click sign-in to a shared demo account.
 *
 * The browser sends only which role it wants. The password is read from the
 * server environment and used here, by the cookie-bound server client, so it
 * never reaches the page. On success the visitor lands on the dashboard, which
 * renders the seeker or recruiter view for the account's role.
 */
export async function signInAsDemo(role: unknown): Promise<{ error: string }> {
  const t = await demoStrings();
  if (!isDemoMode()) return { error: t.errors.off };
  // The argument comes off the wire; the compile-time type means nothing here.
  if (!isDemoRole(role)) return { error: t.errors.off };

  const password = demoPassword(role);
  if (!password) return { error: t.errors.notConfigured };

  if (!(await rateLimitRequest("demo"))) return { error: t.errors.rateLimited };

  const supabase = await createClient();
  const { email } = DEMO_ACCOUNTS[role];
  let { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && isWrongCredentials(error.message) && (await restoreDemoPassword(role, password))) {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }

  if (error) {
    // Most often the nightly reset is mid-run and the account does not exist
    // for a few seconds. Logged, never shown: the visitor gets a retry hint.
    console.error(`[demo] sign-in as ${role} failed: ${error.message}`);
    return { error: t.errors.unavailable };
  }

  redirect("/dashboard");
}

/** `useActionState` adapter: the role arrives as the pressed button's value. */
export async function demoSignInAction(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  return signInAsDemo(formData.get("role"));
}

function isWrongCredentials(message: string): boolean {
  return message.toLowerCase().includes("invalid login credentials");
}
