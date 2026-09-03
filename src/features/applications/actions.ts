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
  /** true when the seeker clicked through to the job's external apply_url —
   *  we record the interest so the recruiter can see who applied. */
  external?: boolean;
}): Promise<ApplyResult> {
  const profile = await requireRole("seeker");
  const external = input.external === true;

  const parsed = applySchema.safeParse({
    note: external ? undefined : input.note,
    attachCv: external ? false : input.attachCv ?? true,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: seeker } = await supabase
    .from("seeker_profiles")
    .select("headline, cv_path, cv_filename")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // On-site applications need at least a headline (case 2); an external
  // click-through is just an interest record, so we don't gate it.
  if (!external && !seeker?.headline) {
    return {
      ok: false,
      needsProfile: true,
      error: "Add a headline to your profile before applying.",
    };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, apply_url, company_id")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job || job.status !== "published") {
    return { ok: false, error: "This job isn't accepting applications." };
  }
  if (job.apply_url && !external) {
    return {
      ok: false,
      error: "This role is applied to on the company's own site.",
    };
  }
  if (!job.apply_url && external) {
    return { ok: false, error: "This role is applied to on Perch." };
  }

  const attach = !external && parsed.data.attachCv && seeker?.cv_path;
  const { error } = await supabase.from("applications").insert({
    job_id: job.id,
    seeker_id: profile.id,
    via: external ? "external" : "onsite",
    note: external ? null : parsed.data.note || null,
    cv_path: attach ? seeker!.cv_path : null,
    cv_filename: attach ? seeker!.cv_filename : null,
  });

  if (error) {
    if (error.code === "23505") return { ok: true, alreadyApplied: true };
    return { ok: false, error: error.message };
  }

  void notifyRecruiter({
    ownerCompanyId: job.company_id,
    jobId: job.id,
    jobTitle: job.title,
    applicantName: profile.fullName ?? profile.email,
    applicantHeadline: seeker?.headline ?? null,
    note: parsed.data.note ?? null,
    external,
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
  external: boolean;
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
      note: input.external
        ? "Applied via your external application link — details are on your own site."
        : input.note,
      external: input.external,
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
