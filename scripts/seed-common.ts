import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local" });

/**
 * Shared setup for the seed scripts.
 *
 * Every account the seed creates lives on one domain. That single fact is what
 * makes the data removable later: `seed:clear` deletes exactly the accounts on
 * this domain and lets the schema's cascades take their companies, jobs,
 * applications and saved jobs with them. Nothing has to be tracked separately,
 * and nothing outside the domain can be caught by accident.
 */
export const SEED_DOMAIN = "seed.perch.test";

export function isSeedEmail(email: string | undefined | null): boolean {
  return (email ?? "").toLowerCase().endsWith(`@${SEED_DOMAIN}`);
}

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

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

/** `auth.users` is paginated; walk it rather than assuming one page. */
export async function listAllUsers(): Promise<{ id: string; email: string }[]> {
  const users: { id: string; email: string }[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const batch = data?.users ?? [];
    for (const u of batch) users.push({ id: u.id, email: u.email ?? "" });
    if (batch.length < 200) break;
  }
  return users;
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
