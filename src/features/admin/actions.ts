"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, requireRole } from "@/features/auth/session";
import { slugify } from "@/lib/slug";
import { SEED_JOBS } from "@/features/jobs/seed";

type Result = { ok: boolean; error?: string; message?: string };

/** Extra guard: confirm the caller's email is actually in admin_emails, not just
 *  a profiles.role we trust. Belt-and-suspenders for the destructive actions. */
async function assertAdmin(): Promise<void> {
  await requireRole("admin");
  const user = await getUser();
  const email = user?.email?.toLowerCase();
  if (!email) throw new Error("not authenticated");
  const admin = createAdminClient();
  const { data } = await admin.from("admin_emails").select("email");
  const listed = (data ?? []).some((r) => r.email.toLowerCase() === email);
  if (!listed) throw new Error("not an admin");
}

export async function adminDeleteJob(id: string): Promise<Result> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function adminDeleteUser(id: string): Promise<Result> {
  await assertAdmin();
  const me = await getUser();
  if (me?.id === id) return { ok: false, error: "You can't delete your own account here." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Delete the demo dataset — the seeded companies (owner_id IS NULL) cascade to
 *  their jobs and any applications/saved rows. */
export async function adminWipeDemo(): Promise<Result> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .delete()
    .is("owner_id", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/jobs");
  return { ok: true, message: "Demo data removed." };
}

/** Re-insert the 14 demo companies + jobs from the seed array (idempotent upsert). */
export async function adminReseedDemo(): Promise<Result> {
  await assertAdmin();
  const admin = createAdminClient();

  const companyNames = Array.from(new Set(SEED_JOBS.map((j) => j.company)));
  const companyRows = companyNames.map((name) => ({
    name,
    slug: slugify(name),
    owner_id: null,
    logo_color:
      SEED_JOBS.find((j) => j.company === name)?.companyLogoColor ?? "#1e5f45",
    description: `Open roles at ${name}.`,
  }));
  const { data: companies, error: cErr } = await admin
    .from("companies")
    .upsert(companyRows, { onConflict: "slug" })
    .select("id, slug");
  if (cErr) return { ok: false, error: `companies: ${cErr.message}` };

  const idBySlug = new Map((companies ?? []).map((c) => [c.slug as string, c.id as string]));
  const jobRows = SEED_JOBS.map((j) => {
    const companyId = idBySlug.get(slugify(j.company));
    if (!companyId) throw new Error(`no company for ${j.company}`);
    return {
      slug: j.id,
      company_id: companyId,
      title: j.title,
      location: j.location,
      type: j.type,
      work_mode: j.workMode,
      experience: j.experience,
      salary_min: j.salaryMin,
      salary_max: j.salaryMax,
      currency: j.currency,
      description: j.description,
      responsibilities: j.responsibilities,
      requirements: j.requirements,
      perks: j.perks,
      tags: j.tags,
      apply_url: j.applyUrl || null,
      status: "published" as const,
    };
  });
  const { error: jErr } = await admin
    .from("jobs")
    .upsert(jobRows, { onConflict: "slug" });
  if (jErr) return { ok: false, error: `jobs: ${jErr.message}` };

  revalidatePath("/admin");
  revalidatePath("/jobs");
  return { ok: true, message: `Seeded ${companyRows.length} companies + ${jobRows.length} jobs.` };
}
