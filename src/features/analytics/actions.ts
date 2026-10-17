"use server";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Count one view of a job.
 *
 * All the rules live in `record_job_view()` (migration 0019): only published
 * jobs count, and the hiring team's own traffic is excluded. Called over the
 * request-scoped client rather than the service role so the function can tell
 * whose view it is.
 *
 * Returns nothing and throws nothing: a missed view must never surface to the
 * person reading the job post.
 */
export async function recordJobView(jobId: string): Promise<void> {
  // Deliberately unauthenticated — anonymous views are the point — so the
  // one thing the caller controls is checked before it reaches the
  // database. Postgres would reject a non-uuid anyway; this just avoids
  // spending a round-trip on it.
  if (!UUID.test(jobId)) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_job_view", { p_job: jobId });
    if (error) console.error("[recordJobView]", error);
  } catch (error) {
    console.error("[recordJobView] unavailable", error);
  }
}
