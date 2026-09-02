"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";
import { sendNewApplicantEmail } from "@/lib/email";
import { applySchema } from "@/features/applications/schema";

type ApplyResult =
  | { ok: true; alreadyApplied?: boolean }
  | { ok: false; error: string; needsProfile?: boolean };

export async function applyToJob(input: {
  jobId: string;
  note?: string;
  attachCv?: boolean;
}): Promise<ApplyResult> {
  const profile = await requireRole("seeker");
  const parsed = applySchema.safeParse({
    note: input.note,
    attachCv: input.attachCv ?? true,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  // Case 2: applying needs at least a headline on file.
  const { data: seeker } = await supabase
    .from("seeker_profiles")
    .select("headline, cv_path, cv_filename")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!seeker?.headline) {
    return {
      ok: false,
      needsProfile: true,
      error: "Add a headline to your profile before applying.",
    };
  }

  // Job must exist, be published, and collect applications on-site.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, apply_url, company_id")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job || job.status !== "published") {
    return { ok: false, error: "This job isn't accepting applications." };
  }
  if (job.apply_url) {
    return { ok: false, error: "This role is applied to on the company's own site." };
  }

  const attach = parsed.data.attachCv && seeker.cv_path;
  const { error } = await supabase.from("applications").insert({
    job_id: job.id,
    seeker_id: profile.id,
    note: parsed.data.note || null,
    cv_path: attach ? seeker.cv_path : null,
    cv_filename: attach ? seeker.cv_filename : null,
  });

  if (error) {
    // 23505 = unique (job_id, seeker_id)
    if (error.code === "23505") return { ok: true, alreadyApplied: true };
    return { ok: false, error: error.message };
  }

  // Best-effort recruiter notification — never fail the (committed) application.
  void notifyRecruiter({
    ownerCompanyId: job.company_id,
    jobId: job.id,
    jobTitle: job.title,
    applicantName: profile.fullName ?? profile.email,
    applicantHeadline: seeker.headline,
    note: parsed.data.note ?? null,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/jobs`);
  return { ok: true };
}

async function notifyRecruiter(input: {
  ownerCompanyId: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
  applicantHeadline: string | null;
  note: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: company } = await admin
      .from("companies")
      .select("owner_id")
      .eq("id", input.ownerCompanyId)
      .maybeSingle();
    if (!company?.owner_id) return;

    const { data: owner } = await admin.auth.admin.getUserById(company.owner_id);
    const to = owner.user?.email;
    if (!to) return;

    await sendNewApplicantEmail({
      to,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      applicantName: input.applicantName,
      applicantHeadline: input.applicantHeadline,
      note: input.note,
    });
  } catch (error) {
    console.error("[applyToJob] recruiter notification failed", error);
  }
}

/** Short-lived signed URL for an applicant's CV. Authorised by RLS: the caller
 *  only sees the `applications` row (and its cv_path) if they own the job. */
export async function getCvUrl(
  applicationId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireRole("recruiter");
  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("cv_path")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application?.cv_path) {
    return { ok: false, error: "No CV attached to this application." };
  }

  const { data, error } = await createAdminClient()
    .storage.from("cvs")
    .createSignedUrl(application.cv_path, 60);
  if (error || !data?.signedUrl) {
    return { ok: false, error: "Couldn't generate the download link." };
  }
  return { ok: true, url: data.signedUrl };
}

export async function withdrawApplication(
  applicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("seeker");
  const supabase = await createClient();
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
