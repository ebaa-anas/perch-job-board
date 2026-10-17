"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";
import { isOwnCvPath } from "@/features/profiles/cv-path";
import { seekerProfileSchema, type SeekerProfileInput } from "@/features/profiles/schema";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function upsertSeekerProfile(
  values: SeekerProfileInput,
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
      // `?? null` rather than `|| null`: false is a real answer for these
      // and must not be flattened into "not said".
      experience: parsed.data.experience ?? null,
      no_professional_experience: parsed.data.noProfessionalExperience ?? null,
      needs_visa_sponsorship: parsed.data.needsVisaSponsorship ?? null,
      work_authorization: parsed.data.workAuthorization ?? null,
      desired_types: parsed.data.desiredTypes,
      desired_work_modes: parsed.data.desiredWorkModes,
      desired_locations: parsed.data.desiredLocations,
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

/**
 * Delete a CV object, but only when no application still points at it.
 *
 * `applications.cv_path` is a snapshot taken at apply time, and 0005 promises
 * the recruiter who owns the job can download exactly what was sent. Deleting
 * the object out from under those rows turned every past application into a
 * dead link — the seeker tidying their profile silently broke someone else's
 * inbox.
 *
 * RLS limits this count to the caller's own applications, which is precisely
 * the set that matters: the path lives in their folder, so nobody else's
 * application could reference it.
 */
async function removeCvObjectIfUnreferenced(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<void> {
  const { count, error } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("cv_path", path);
  // Fail safe: if the count can't be read, keep the file. An orphaned object
  // costs storage; a missing one costs a recruiter the document they were sent.
  if (error) {
    console.error("[cv] reference check failed, keeping object", error);
    return;
  }
  if ((count ?? 0) > 0) return;

  // Service role for the delete itself. `cvs` is private and 0002 gives it
  // INSERT/UPDATE/DELETE policies but no SELECT, and Storage looks an object up
  // before removing it — so the user's own client silently removes nothing, and
  // every "deleted" CV has in fact been orphaned since 0002. Same split as
  // getCvUrl: authorisation happens above (seeker session, path ownership, and
  // an RLS-scoped reference count), the service role only carries it out.
  const { error: removeError } = await createAdminClient()
    .storage.from("cvs")
    .remove([path]);
  if (removeError) {
    console.error("[cv] object delete failed", removeError);
  }
}

export async function setCv(input: {
  path: string;
  filename: string;
}): Promise<ActionResult> {
  const profile = await requireRole("seeker");
  if (!isOwnCvPath(input.path, profile.id)) {
    return { ok: false, error: "That file isn't in your folder." };
  }
  const supabase = await createClient();

  // The CV this one replaces, so the old object can be cleaned up afterwards.
  const { data: previous } = await supabase
    .from("seeker_profiles")
    .select("cv_path")
    .eq("profile_id", profile.id)
    .maybeSingle();

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

  // Replacing a CV used to leave the old file behind forever. Clear it now,
  // under the same rule as removeCv: keep it if an application still needs it.
  if (previous?.cv_path && previous.cv_path !== input.path) {
    await removeCvObjectIfUnreferenced(supabase, previous.cv_path);
  }

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

  // Detach first: the profile should stop advertising the CV even if the object
  // has to stay behind for an application that already cites it.
  const { error } = await supabase
    .from("seeker_profiles")
    .update({ cv_path: null, cv_filename: null })
    .eq("profile_id", profile.id);
  if (error) return { ok: false, error: error.message };

  if (row?.cv_path) {
    await removeCvObjectIfUnreferenced(supabase, row.cv_path);
  }

  revalidatePath("/profile");
  return { ok: true };
}
