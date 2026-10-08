import { cache } from "react";

import { getJobs } from "@/features/jobs/data";
import { getUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { aggregateSkillGaps, type SkillGap } from "@/features/matching/skill-gaps";

/**
 * Skill gaps across the jobs the signed-in seeker has shown interest in.
 *
 * "Interest" means saved or applied to — the two signals the seeker gave
 * deliberately. Browsing history would be a larger sample and a worse one:
 * it would include every role they opened and rejected, which is exactly the
 * set they do not want advice about.
 */
export const getOwnSkillGaps = cache(
  async (): Promise<{ gaps: SkillGap[]; jobCount: number }> => {
    const user = await getUser();
    if (!user) return { gaps: [], jobCount: 0 };

    const supabase = await createClient();
    const [saved, applied, profile, allJobs] = await Promise.all([
      supabase.from("saved_jobs").select("job_id"),
      supabase.from("applications").select("job_id"),
      getOwnSeekerProfile(),
      getJobs(),
    ]);

    const wanted = new Set<string>();
    for (const row of saved.data ?? []) wanted.add(row.job_id);
    for (const row of applied.data ?? []) wanted.add(row.job_id);
    if (wanted.size === 0) return { gaps: [], jobCount: 0 };

    // Only published jobs are in `getJobs()`, so a role that has since closed
    // drops out rather than skewing the advice toward a dead market.
    const jobs = allJobs.filter((job) => wanted.has(job.id));
    if (jobs.length === 0) return { gaps: [], jobCount: 0 };

    return {
      gaps: aggregateSkillGaps(jobs, profile?.skills ?? []),
      jobCount: jobs.length,
    };
  },
);
