import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";
import { DEMO_ACCOUNTS, type DemoRole } from "@/features/demo/demo-rules";

/**
 * Server-side demo helpers. Kept apart from `actions.ts` on purpose: nothing
 * in here may become a Server Action, because `restoreDemoPassword` must never
 * be reachable as a public POST endpoint.
 */

export type DemoBlockedAction = keyof Dictionary["demo"]["blocked"];

/** The demo strings in the visitor's language, for messages actions return. */
export async function demoStrings(): Promise<Dictionary["demo"]> {
  return getDictionary(await getLocale()).demo;
}

/** The friendly refusal shown when a demo account tries `action`. */
export async function demoBlocked(action: DemoBlockedAction): Promise<string> {
  return (await demoStrings()).blocked[action];
}

/**
 * A demo login's password, from the server environment only. These variables
 * are deliberately not `NEXT_PUBLIC_`, so they are never inlined into a bundle.
 */
export function demoPassword(role: DemoRole): string | null {
  const value =
    role === "seeker"
      ? process.env.DEMO_SEEKER_PASSWORD
      : process.env.DEMO_RECRUITER_PASSWORD;
  return value?.trim() ? value : null;
}

/** Email of the account that owns `companyId`, or null for an ownerless one. */
export async function companyOwnerEmail(companyId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company?.owner_id) return null;

  const { data } = await admin.auth.admin.getUserById(company.owner_id);
  return data.user?.email ?? null;
}

/**
 * Put a demo login's password back to the configured value.
 *
 * A visitor holds a genuine session on a shared account, so nothing stops them
 * calling the Auth API directly and changing its password — which would lock
 * every later visitor out until the nightly reset. The sign-in action calls
 * this after a credentials failure and retries once.
 *
 * Takes a role, not an address: it can only ever touch the two fixed demo
 * logins, never an account named by the caller.
 */
export async function restoreDemoPassword(
  role: DemoRole,
  password: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const target = DEMO_ACCOUNTS[role].email;

  // auth.users is paginated and `profiles` has no email column, so walk it.
  // Only reached after a failed demo sign-in, never on the happy path.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("[demo] listUsers failed", error.message);
      return false;
    }
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) {
      const { error: updateError } = await admin.auth.admin.updateUserById(match.id, {
        password,
      });
      if (updateError) {
        console.error("[demo] password restore failed", updateError.message);
        return false;
      }
      return true;
    }
    if (users.length < 200) return false;
  }
  return false;
}
