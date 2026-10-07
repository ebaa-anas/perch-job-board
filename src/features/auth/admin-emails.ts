import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { isListedAdminEmail } from "@/features/auth/admin-emails-match";

/**
 * Who counts as an admin, in one place.
 *
 * `profiles.role` is a cache of this answer, not the answer itself. It goes
 * stale when someone is dropped from `admin_emails` mid-session, and before
 * migration 0014 it could be forged outright at signup. `admin_emails` is the
 * source of truth, so both the route guard (`requireRole`) and the login-time
 * reconciliation (`maybeUpgradeAdmin`) ask here rather than trusting the row.
 */

/**
 * Whether `email` is registered in `admin_emails`.
 *
 * Runs on the service-role client because `admin_emails` has no RLS read policy
 * — an admin has to be able to confirm their own status without the table being
 * readable by everyone. Request-scoped via `React.cache`, so a layout guard and
 * the actions beneath it share a single round-trip.
 */
export const isAdminEmail = cache(
  async (email: string | null | undefined): Promise<boolean> => {
    if (!email) return false;
    const { data, error } = await createAdminClient()
      .from("admin_emails")
      .select("email");
    // Fail closed: if the list can't be read, nobody is an admin this request.
    // The alternative — assuming the last known answer — keeps a revoked admin
    // in the console exactly when the database is misbehaving.
    if (error) {
      console.error("[isAdminEmail] admin_emails lookup failed", error);
      return false;
    }
    return isListedAdminEmail(data ?? [], email);
  },
);
