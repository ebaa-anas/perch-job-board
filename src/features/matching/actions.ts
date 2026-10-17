"use server";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/claude";
import { getUser } from "@/features/auth/session";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { getPublishedJobById } from "@/features/jobs/data";
import { fitAssessmentSchema, type FitAssessment } from "@/features/matching/schema";
import {
  buildFitScoreInput,
  extractJson,
  FIT_SCORE_SYSTEM_PROMPT,
} from "@/features/matching/prompt";

export type FitScoreResult =
  | { ok: true; data: FitAssessment }
  | {
      ok: false;
      reason:
        | "signed-out"
        | "no-profile"
        | "not-found"
        | "unavailable"
        | "rate-limited";
    };

/**
 * How many fresh scorings one seeker may trigger in a rolling day. Each miss is
 * a paid Claude call, and the per-(seeker, job) cache only absorbs repeat views
 * of the same job against an unchanged profile — someone walking the whole job
 * list, or editing their profile between requests, misses every time. Well clear
 * of what a real job hunt looks like, low enough to bound the bill.
 */
const DAILY_SCORE_LIMIT = 50;

function hasProfileContent(profile: {
  headline: string | null;
  bio: string | null;
  skills: string[];
}): boolean {
  return Boolean(profile.headline || profile.bio || profile.skills.length > 0);
}

/**
 * The signed-in seeker's AI-generated fit score for a job, cached per
 * (seeker, job) and re-computed only when the profile or job content behind
 * it has actually changed (see `buildFitScoreInput`'s fingerprint).
 */
export async function getFitScore(jobId: string): Promise<FitScoreResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const [job, profile] = await Promise.all([
    getPublishedJobById(jobId),
    getOwnSeekerProfile(),
  ]);
  if (!job) return { ok: false, reason: "not-found" };
  if (!profile || !hasProfileContent(profile)) {
    return { ok: false, reason: "no-profile" };
  }

  const input = buildFitScoreInput(profile, job);
  const inputHash = createHash("sha256").update(input).digest("hex");

  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("job_fit_scores")
    .select("input_hash, score, summary, strengths, gaps")
    .eq("seeker_id", user.id)
    .eq("job_id", jobId)
    .maybeSingle();

  if (cached && cached.input_hash === inputHash) {
    return {
      ok: true,
      data: {
        score: cached.score,
        summary: cached.summary,
        strengths: cached.strengths,
        gaps: cached.gaps,
      },
    };
  }

  // Cache miss from here on, so this request is about to cost money. Count the
  // seeker's recent scorings first — RLS scopes the table to the caller, so the
  // count can only ever be their own.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentScores } = await supabase
    .from("job_fit_scores")
    .select("job_id", { count: "exact", head: true })
    .eq("seeker_id", user.id)
    .gte("updated_at", since);
  if ((recentScores ?? 0) >= DAILY_SCORE_LIMIT) {
    return { ok: false, reason: "rate-limited" };
  }

  const raw = await callClaude({ system: FIT_SCORE_SYSTEM_PROMPT, user: input });
  if (!raw) return { ok: false, reason: "unavailable" };

  let candidate: unknown;
  try {
    candidate = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const parsed = fitAssessmentSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: "unavailable" };

  // Service role, because 0014 narrowed the seeker's own policy on this table to
  // SELECT. That is the point: the row records how much quota they have spent,
  // so leaving it writable by them let a seeker delete it or backdate
  // updated_at and reset the cap. `seeker_id` comes from the verified session
  // below, never from anything the caller passed in.
  await createAdminClient().from("job_fit_scores").upsert({
    seeker_id: user.id,
    job_id: jobId,
    input_hash: inputHash,
    score: parsed.data.score,
    summary: parsed.data.summary,
    strengths: parsed.data.strengths,
    gaps: parsed.data.gaps,
    // Explicit, because a re-score updates an existing row and the column
    // default only applies on insert — without this the daily count would stop
    // seeing refreshes of jobs the seeker had already scored once.
    updated_at: new Date().toISOString(),
  });

  return { ok: true, data: parsed.data };
}
