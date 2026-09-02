"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { seekerProfileSchema, type SeekerProfileValues } from "@/features/profiles/schema";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertSeekerProfile(
  values: SeekerProfileValues,
): Promise<ActionResult> {
  const profile = await requireRole("seeker");
  const parsed = seekerProfileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("seeker_profiles").upsert(
    {
      profile_id: profile.id,
      headline: parsed.data.headline || null,
      location: parsed.data.location || null,
      bio: parsed.data.bio || null,
      skills: parsed.data.skills,
      portfolio_url: parsed.data.portfolioUrl || null,
      linkedin_url: parsed.data.linkedinUrl || null,
      github_url: parsed.data.githubUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function setCv(input: {
  path: string;
  filename: string;
}): Promise<ActionResult> {
  const profile = await requireRole("seeker");
  if (!input.path.startsWith(`${profile.id}/`)) {
    return { ok: false, error: "That file isn't in your folder." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("seeker_profiles").upsert(
    {
      profile_id: profile.id,
      cv_path: input.path,
      cv_filename: input.filename.slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

export async function removeCv(): Promise<ActionResult> {
  const profile = await requireRole("seeker");
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("seeker_profiles")
    .select("cv_path")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (row?.cv_path) {
    await supabase.storage.from("cvs").remove([row.cv_path]);
  }
  const { error } = await supabase
    .from("seeker_profiles")
    .update({ cv_path: null, cv_filename: null })
    .eq("profile_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}
