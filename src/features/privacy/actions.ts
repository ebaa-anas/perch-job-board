"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, requireUser } from "@/features/auth/session";

/**
 * Subject-access and erasure, self-service.
 *
 * KVKK (Türkiye) and the GDPR both give a person the right to a copy of their
 * data and the right to have it deleted, and both expect it without having to
 * email anyone. For a product whose core asset is uploaded CVs, "write to
 * support" is not a credible answer — so both are a button.
 *
 * Export reads over the request-scoped client, so RLS is the guarantee that a
 * caller can only ever assemble their own file. Deletion has to use the
 * service role (removing an auth user is an admin operation), and so takes
 * the subject id from the verified session and never from an argument.
 */

export interface DataExport {
  exportedAt: string;
  account: Record<string, unknown>;
  seekerProfile: unknown;
  company: unknown;
  applications: unknown;
  savedJobs: unknown;
  savedSearches: unknown;
  notifications: unknown;
  reviews: unknown;
  fitScores: unknown;
}

export async function exportMyData(): Promise<
  { ok: true; data: DataExport } | { ok: false; error: string }
> {
  await requireUser("/profile");
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Sign in again to export your data." };

  const supabase = await createClient();

  // Every read below is RLS-scoped to the caller, which is what makes this
  // safe to run without a single explicit `eq` on their own id.
  const [
    seekerProfile,
    company,
    applications,
    savedJobs,
    savedSearches,
    notifications,
    reviews,
    fitScores,
  ] = await Promise.all([
    supabase.from("seeker_profiles").select("*").maybeSingle(),
    supabase.from("companies").select("*").eq("owner_id", profile.id).maybeSingle(),
    supabase
      .from("applications")
      .select(
        "id, created_at, note, custom_answers, cv_filename, jobs ( title, companies ( name ) )",
      )
      .eq("seeker_id", profile.id),
    supabase.from("saved_jobs").select("job_id, created_at"),
    supabase.from("saved_searches").select("label, query, frequency, created_at"),
    supabase.from("notifications").select("kind, title, body, created_at, read_at"),
    supabase
      .from("company_reviews")
      .select("rating, body, created_at, companies ( name )")
      .eq("reviewer_id", profile.id),
    supabase.from("job_fit_scores").select("job_id, score, summary, updated_at"),
  ]);

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      account: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      },
      seekerProfile: seekerProfile.data ?? null,
      company: company.data ?? null,
      applications: applications.data ?? [],
      savedJobs: savedJobs.data ?? [],
      savedSearches: savedSearches.data ?? [],
      notifications: notifications.data ?? [],
      reviews: reviews.data ?? [],
      fitScores: fitScores.data ?? [],
    },
  };
}

/**
 * Erase the account.
 *
 * Deleting the `auth.users` row cascades through `profiles` and from there to
 * everything keyed on it — applications, saved jobs, alerts, notifications,
 * reviews, pipeline rows and the append-only event log. Stored objects do not
 * cascade, so the CV is removed explicitly first; leaving it would be the one
 * piece of genuinely personal data to survive an erasure request.
 *
 * A company owner is refused rather than silently taking their jobs and every
 * applicant's submitted application down with them. They transfer ownership or
 * delete the company first, deliberately.
 */
export async function deleteMyAccount(
  confirmation: string,
): Promise<{ ok: false; error: string } | never> {
  await requireUser("/profile");
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Sign in again to delete your account." };

  if (confirmation.trim().toLowerCase() !== "delete") {
    return { ok: false, error: 'Type "delete" to confirm.' };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id, name")
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (ownedCompany) {
    return {
      ok: false,
      error:
        `You still own ${ownedCompany.name}. Transfer it to a teammate or ` +
        `delete the company first — deleting your account would take its ` +
        `jobs and every application to them with it.`,
    };
  }

  const { data: seeker } = await supabase
    .from("seeker_profiles")
    .select("cv_path")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (seeker?.cv_path) {
    const { error } = await admin.storage.from("cvs").remove([seeker.cv_path]);
    // Reported rather than ignored: an erasure that silently leaves the CV
    // behind is the failure that matters most here.
    if (error) {
      console.error("[deleteMyAccount] CV removal failed", error);
      return {
        ok: false,
        error: "Couldn't remove your CV file. Nothing was deleted — try again.",
      };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) {
    console.error("[deleteMyAccount] user deletion failed", error);
    return { ok: false, error: "Couldn't delete the account. Nothing was changed." };
  }

  redirect("/?deleted=1");
}
