"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { pickFreeSlug, slugify } from "@/lib/slug";
import {
  jobEditorApiSchema,
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

async function ownCompany(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string) {
  const { data } = await supabase
    .from("companies")
    .select("id, slug, suspended_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data;
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
    apply_url: input.applyUrl ? input.applyUrl : null,
  };
}

function revalidateJob(slug: string, companySlug?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${slug}`);
  if (companySlug) revalidatePath(`/companies/${companySlug}`);
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
