"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";
import { sendApplicationStatusEmail } from "@/lib/email";
import { createNotification } from "@/features/notifications/notify";
import {
  APPLICATION_STAGES,
  canTransition,
  isApplicationStage,
  seekerStatusFor,
  type ApplicationStage,
} from "@/features/applications/pipeline";

/**
 * Recruiter-side pipeline mutations.
 *
 * Authorisation is the database's: `application_pipeline` and
 * `application_events` are both writable only when `owns_application()` (see
 * migration 0015), so a forged POST straight at one of these actions cannot
 * touch someone else's candidates even though the guard here is only
 * `requireRole("recruiter")`.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_MESSAGE = 2000;

const stageSchema = z.enum(APPLICATION_STAGES);

const setStageSchema = z.object({
  applicationId: z.string().uuid(),
  stage: stageSchema,
  message: z.string().trim().max(MAX_MESSAGE).optional(),
  /** Recruiters can suppress the email for bookkeeping-only corrections. */
  notify: z.boolean().optional(),
});

const noteSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(MAX_MESSAGE),
});

const ratingSchema = z.object({
  applicationId: z.string().uuid(),
  /** `null` clears the rating. */
  rating: z.number().int().min(1).max(5).nullable(),
});

interface ApplicationContext {
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  companyName: string;
  seekerId: string;
  stage: ApplicationStage;
  decidedAt: string | null;
}

/**
 * Load the one application plus the bits needed to notify and revalidate.
 * Returns null when RLS hides it, which is the same answer as "not yours".
 */
async function loadContext(
  applicationId: string,
): Promise<ApplicationContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "seeker_id, application_pipeline ( stage, decided_at ), " +
        "jobs!inner ( id, slug, title, companies!inner ( name ) )",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!data) return null;

  type Row = {
    seeker_id: string;
    application_pipeline: { stage: string; decided_at: string | null } | null;
    jobs: { id: string; slug: string; title: string; companies: { name: string } };
  };
  const row = data as unknown as Row;

  return {
    jobId: row.jobs.id,
    jobSlug: row.jobs.slug,
    jobTitle: row.jobs.title,
    companyName: row.jobs.companies.name,
    seekerId: row.seeker_id,
    stage: isApplicationStage(row.application_pipeline?.stage)
      ? row.application_pipeline.stage
      : "applied",
    decidedAt: row.application_pipeline?.decided_at ?? null,
  };
}

/**
 * Move one application to a new stage.
 *
 * Writes three things, in this order: the new stage, an append-only event the
 * candidate can read, and an email. The event is what the candidate's timeline
 * renders, so it is written even if the email fails — the in-product record is
 * the promise, the email is the convenience.
 */
export async function setApplicationStage(input: {
  applicationId: string;
  stage: ApplicationStage;
  message?: string;
  notify?: boolean;
}): Promise<ActionResult> {
  const profile = await requireRole("recruiter");

  const parsed = setStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { applicationId, stage, message } = parsed.data;
  const notify = parsed.data.notify ?? true;

  const context = await loadContext(applicationId);
  if (!context) return { ok: false, error: "Application not found." };

  if (!canTransition(context.stage, stage)) {
    return context.stage === stage
      ? { ok: true }
      : { ok: false, error: `Can't move an application out of "${context.stage}".` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_pipeline")
    .update({
      stage,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
      // Stamped once, the first time a human responds at all. Never moved
      // afterwards, so time-to-first-response stays honest under later edits.
      decided_at:
        context.decidedAt ?? (stage === "applied" ? null : new Date().toISOString()),
    })
    .eq("application_id", applicationId);

  if (error) return { ok: false, error: error.message };

  const { error: eventError } = await supabase.from("application_events").insert({
    application_id: applicationId,
    actor_id: profile.id,
    kind: "stage_change",
    from_stage: context.stage,
    to_stage: stage,
    body: message || null,
    visibility: "seeker",
  });
  if (eventError) {
    console.error("[setApplicationStage] event insert failed", eventError);
  }

  // The in-app record is written regardless of the email preference: the
  // candidate-facing promise is that the status is always visible to them.
  void createNotification({
    profileId: context.seekerId,
    kind: "application_status",
    title: `${context.companyName} updated your application for ${context.jobTitle}`,
    body: message || null,
    url: "/dashboard",
  });

  if (notify) {
    void notifySeeker({
      seekerId: context.seekerId,
      jobTitle: context.jobTitle,
      companyName: context.companyName,
      stage,
      message: message || null,
    });
  }

  revalidatePath(`/dashboard/jobs/${context.jobId}/applicants`);
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${context.jobSlug}`);
  return { ok: true };
}

/**
 * Move several applications at once.
 *
 * Rejection at volume is the work recruiters skip, and skipping it is exactly
 * what leaves candidates in the dark — so it has to be one action, not twenty.
 * Partial success is reported rather than rolled back: having told fifteen of
 * twenty candidates is strictly better than having told none.
 */
export async function bulkSetApplicationStage(input: {
  applicationIds: string[];
  stage: ApplicationStage;
  message?: string;
  notify?: boolean;
}): Promise<{ ok: true; updated: number; failed: number } | { ok: false; error: string }> {
  await requireRole("recruiter");

  const parsed = z
    .object({
      applicationIds: z.array(z.string().uuid()).min(1).max(100),
      stage: stageSchema,
      message: z.string().trim().max(MAX_MESSAGE).optional(),
      notify: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let updated = 0;
  let failed = 0;
  for (const applicationId of parsed.data.applicationIds) {
    const result = await setApplicationStage({
      applicationId,
      stage: parsed.data.stage,
      message: parsed.data.message,
      notify: parsed.data.notify,
    });
    if (result.ok) updated += 1;
    else failed += 1;
  }

  return { ok: true, updated, failed };
}

/** An internal triage note. Never shown to the candidate. */
export async function addApplicationNote(input: {
  applicationId: string;
  body: string;
}): Promise<ActionResult> {
  const profile = await requireRole("recruiter");

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const context = await loadContext(parsed.data.applicationId);
  if (!context) return { ok: false, error: "Application not found." };

  const supabase = await createClient();
  const { error } = await supabase.from("application_events").insert({
    application_id: parsed.data.applicationId,
    actor_id: profile.id,
    kind: "note",
    body: parsed.data.body,
    visibility: "internal",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${context.jobId}/applicants`);
  return { ok: true };
}

/** A 1–5 internal rating, or null to clear it. Never shown to the candidate. */
export async function rateApplicant(input: {
  applicationId: string;
  rating: number | null;
}): Promise<ActionResult> {
  const profile = await requireRole("recruiter");

  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const context = await loadContext(parsed.data.applicationId);
  if (!context) return { ok: false, error: "Application not found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_pipeline")
    .update({
      rating: parsed.data.rating,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("application_id", parsed.data.applicationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${context.jobId}/applicants`);
  return { ok: true };
}

/** Best-effort candidate notification; never fails the stage change. */
async function notifySeeker(input: {
  seekerId: string;
  jobTitle: string;
  companyName: string;
  stage: ApplicationStage;
  message: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(input.seekerId);
    const to = data.user?.email;
    if (!to) return;

    await sendApplicationStatusEmail({
      to,
      jobTitle: input.jobTitle,
      companyName: input.companyName,
      status: seekerStatusFor(input.stage),
      message: input.message,
    });
  } catch (error) {
    console.error("[setApplicationStage] candidate notification failed", error);
  }
}
