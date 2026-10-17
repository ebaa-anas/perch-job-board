import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local" });

/**
 * Shared setup for the seed scripts: the service-role client and the row
 * counts they print. What gets seeded and cleared lives in
 * `src/features/demo/reset.ts`, shared with the daily reset cron.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — check .env.local",
  );
}

/** Service role: bypasses RLS, which seeding and clearing both require. */
export const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Tables the scripts report on, in a stable order. */
export const REPORTED_TABLES = [
  "profiles",
  "seeker_profiles",
  "companies",
  "company_members",
  "company_invites",
  "jobs",
  "job_application_questions",
  "applications",
  "application_pipeline",
  "application_events",
  "saved_jobs",
  "saved_searches",
  "notifications",
  "company_reviews",
  "company_reports",
  "job_fit_scores",
  "job_views",
  "admin_audit_log",
  "rate_limit_hits",
  "admin_emails",
] as const;

export async function countRows(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of REPORTED_TABLES) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });
    counts[table] = error ? -1 : (count ?? 0);
  }
  return counts;
}

export function printCounts(title: string, counts: Record<string, number>): void {
  console.log(`\n${title}`);
  const width = Math.max(...Object.keys(counts).map((k) => k.length));
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(width)}  ${n < 0 ? "error" : n}`);
  }
  const total = Object.values(counts)
    .filter((n) => n >= 0)
    .reduce((a, b) => a + b, 0);
  console.log(`  ${"TOTAL".padEnd(width)}  ${total}`);
}
