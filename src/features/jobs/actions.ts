"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { pickFreeSlug, slugify } from "@/lib/slug";
import {
  jobEditorApiSchema,
  type ApplicationQuestionValues,
  type JobEditorInput,
} from "@/features/jobs/schema";

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const JOB_STATUSES = ["published", "draft", "closed"] as const;
type JobStatus = (typeof JOB_STATUSES)[number];

function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * The company the caller may post for, via `company_members`.
 *
 * Was `companies.owner_id = <caller>`; since migration 0018 every seat holder
 * can post, so an invited recruiter resolves to their team's company. RLS
 * still has the final say — the `jobs` insert policy calls `owns_company()`,
 * which is now membership-based too.
 */
async function ownCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
) {
  const { data } = await supabase
    .from("company_members")
    .select("companies!inner ( id, slug, suspended_at )")
    .eq("profile_id", profileId)
    .maybeSingle();
  const row = data as unknown as {
    companies: { id: string; slug: string; suspended_at: string | null };
  } | null;
  return row?.companies ?? null;
}

const SUSPENDED_MSG =
  "Your company is suspended and can't post or publish jobs. Contact support if you think this is a mistake.";

function toRow(input: JobEditorInput) {
  return {
    title: input.title,
    location: input.location,
    type: input.type,
    work_mode: input.workMode,
    experience: input.experience,
    salary_min: input.salaryMin,
    salary_max: input.salaryMax,
    description: input.description,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    perks: input.perks ?? [],
    tags: input.tags,
    no_experience_required: input.noExperienceRequired,
    visa_sponsorship: input.visaSponsorship,
    language: input.language,
  };
}

function revalidateJob(slug: string, companySlug?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${slug}`);
  if (companySlug) revalidatePath(`/companies/${companySlug}`);
}

/** Replace a job's custom application questions wholesale — simplest correct
 *  behavior for a recruiter re-saving the job editor's question list. */
async function replaceJobQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  questions: ApplicationQuestionValues[],
): Promise<{ error: string | null }> {
  const { error: deleteError } = await supabase
    .from("job_application_questions")
    .delete()
    .eq("job_id", jobId);
  if (deleteError) return { error: deleteError.message };
  if (questions.length === 0) return { error: null };

  const { error: insertError } = await supabase
    .from("job_application_questions")
    .insert(
      questions.map((q, position) => ({
        job_id: jobId,
        label: q.label,
        type: q.type,
        required: q.required,
        options: q.options,
        // A blank gate is not a gate; the column's check constraint rejects
        // an empty string, so normalise it here rather than at the database.
        knockout_answer: q.knockoutAnswer?.trim() ? q.knockoutAnswer.trim() : null,
        position,
      })),
    );
  return { error: insertError?.message ?? null };
}

export async function createJob(
  input: JobEditorInput,
  options: { publish: boolean },
): Promise<ActionResult<{ id: string; slug: string }>> {
  const profile = await requireRole("recruiter");
  const parsed = jobEditorApiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const company = await ownCompany(supabase, profile.id);
  if (!company) {
    return { ok: false, error: "Create your company profile before posting a job." };
  }
  if (company.suspended_at) return { ok: false, error: SUSPENDED_MSG };

  const root = slugify(parsed.data.title) || "role";
  const { data: existing } = await supabase
    .from("jobs")
    .select("slug")
    .or(`slug.eq.${root},slug.like.${root}-%`);
  const slug = pickFreeSlug(
    root,
    new Set((existing ?? []).map((r) => r.slug as string)),
  );

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      ...toRow(parsed.data),
      slug,
      company_id: company.id,
      status: options.publish ? "published" : "draft",
    })
    .select("id, slug")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: questionsError } = await replaceJobQuestions(
    supabase,
    data.id,
    parsed.data.questions,
  );
  if (questionsError) return { ok: false, error: questionsError };

  revalidateJob(data.slug, company.slug);
  return { ok: true, data };
}

export async function updateJob(
  id: string,
  input: JobEditorInput,
): Promise<ActionResult<{ slug: string }>> {
  const profile = await requireRole("recruiter");
  const parsed = jobEditorApiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const company = await ownCompany(supabase, profile.id);
  if (!company) return { ok: false, error: "No company on file." };

  // RLS also enforces ownership; company_id filter keeps it explicit.
  const { data, error } = await supabase
    .from("jobs")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", company.id)
    .select("slug")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: questionsError } = await replaceJobQuestions(
    supabase,
    id,
    parsed.data.questions,
  );
  if (questionsError) return { ok: false, error: questionsError };

  revalidateJob(data.slug, company.slug);
  return { ok: true, data };
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
): Promise<ActionResult> {
  const profile = await requireRole("recruiter");
  if (!JOB_STATUSES.includes(status)) {
    return { ok: false, error: "Unknown status." };
  }
  const supabase = await createClient();
  if (status === "published") {
    const company = await ownCompany(supabase, profile.id);
    if (company?.suspended_at) return { ok: false, error: SUSPENDED_MSG };
  }
  const { data, error } = await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug, companies!inner ( slug )")
    .single();
  if (error) return { ok: false, error: error.message };

  const companySlug = (data as { companies?: { slug?: string } }).companies?.slug;
  revalidateJob((data as { slug: string }).slug, companySlug);
  return { ok: true, data: null };
}

export async function deleteJob(id: string): Promise<ActionResult> {
  await requireRole("recruiter");
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true, data: null };
}
