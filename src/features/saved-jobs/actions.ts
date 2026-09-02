"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/auth/session";

type Result = { ok: boolean; error?: string };

async function seekerId(): Promise<string | null> {
  const profile = await getProfile();
  return profile?.role === "seeker" ? profile.id : null;
}

/** Ids the signed-in seeker has saved, newest first. `[]` for anyone else. */
export async function listSavedJobIds(): Promise<string[]> {
  const id = await seekerId();
  if (!id) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_jobs")
    .select("job_id, created_at")
    .eq("seeker_id", id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.job_id as string);
}

export async function saveJob(jobId: string): Promise<Result> {
  const id = await seekerId();
  if (!id) return { ok: false, error: "Sign in as a job seeker to save jobs." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_jobs")
    .upsert({ seeker_id: id, job_id: jobId }, { onConflict: "seeker_id,job_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/saved-jobs");
  return { ok: true };
}

export async function unsaveJob(jobId: string): Promise<Result> {
  const id = await seekerId();
  if (!id) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_jobs")
    .delete()
    .eq("seeker_id", id)
    .eq("job_id", jobId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/saved-jobs");
  return { ok: true };
}

/**
 * Fold a guest's localStorage saves into the account on login, then return the
 * merged id list. Ids are filtered to real jobs first so one stale id (a job
 * deleted since it was saved) can't fail the whole batch insert.
 */
export async function mergeGuestSavedJobs(ids: string[]): Promise<string[]> {
  const id = await seekerId();
  if (!id) return [];
  const clean = Array.from(
    new Set(ids.filter((v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v))),
  ).slice(0, 200);

  if (clean.length > 0) {
    const supabase = await createClient();
    const { data: real } = await supabase
      .from("jobs")
      .select("id")
      .in("id", clean);
    const valid = (real ?? []).map((r) => r.id as string);
    if (valid.length > 0) {
      await supabase
        .from("saved_jobs")
        .upsert(
          valid.map((jobId) => ({ seeker_id: id, job_id: jobId })),
          { onConflict: "seeker_id,job_id", ignoreDuplicates: true },
        );
    }
  }
  return listSavedJobIds();
}
