"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { getUser, requireRole } from "@/features/auth/session";
import { slugify } from "@/lib/slug";
import { SEED_JOBS } from "@/features/jobs/seed";
import { sendAdminMessageEmail } from "@/lib/email";

type Result = { ok: boolean; error?: string; message?: string };

type AdminContext = { id: string; email: string };

/** Confirms the caller is a real admin — profiles.role AND email in admin_emails
 *  — and returns their identity for the audit trail. */
async function requireAdmin(): Promise<AdminContext> {
  await requireRole("admin");
  const user = await getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) throw new Error("not authenticated");
  const admin = createAdminClient();
  const { data } = await admin.from("admin_emails").select("email");
  const listed = (data ?? []).some((r) => r.email.toLowerCase() === email);
  if (!listed) throw new Error("not an admin");
  return { id: user.id, email };
}

async function logAudit(
  actor: AdminContext,
  entry: {
    action: string;
    targetType?: string;
    targetId?: string;
    detail?: Json;
  },
): Promise<void> {
  try {
    await createAdminClient()
      .from("admin_audit_log")
      .insert({
        actor_id: actor.id,
        actor_email: actor.email,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        detail: entry.detail ?? null,
      });
  } catch (error) {
    console.error("[audit] write failed", error);
  }
}

/* -------------------------------------------------------------------------- */
/*  Company moderation                                                         */
/* -------------------------------------------------------------------------- */

export async function suspendCompany(
  id: string,
  reason: string,
): Promise<Result> {
  const actor = await requireAdmin();
  const trimmed = reason.trim();
  if (trimmed.length < 3) return { ok: false, error: "Give a reason (min 3 chars)." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .update({ suspended_at: new Date().toISOString(), suspended_reason: trimmed })
    .eq("id", id)
    .select("name, slug")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(actor, {
    action: "company.suspend",
    targetType: "company",
    targetId: id,
    detail: { name: data.name, reason: trimmed },
  });
  revalidatePath("/admin");
  revalidatePath("/jobs");
  revalidatePath(`/companies/${data.slug}`);
  return { ok: true, message: `${data.name} suspended.` };
}

export async function reinstateCompany(id: string): Promise<Result> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("id", id)
    .select("name, slug")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit(actor, {
    action: "company.reinstate",
    targetType: "company",
    targetId: id,
    detail: { name: data.name },
  });
  revalidatePath("/admin");
  revalidatePath("/jobs");
  revalidatePath(`/companies/${data.slug}`);
  return { ok: true, message: `${data.name} reinstated.` };
}

export async function emailCompany(input: {
  companyId: string;
  subject: string;
  body: string;
}): Promise<Result> {
  const actor = await requireAdmin();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3 || body.length < 10) {
    return { ok: false, error: "Add a subject and a longer message." };
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("name, owner_id")
    .eq("id", input.companyId)
    .maybeSingle();
  if (!company?.owner_id) return { ok: false, error: "No owner to email." };

  const { data: owner } = await admin.auth.admin.getUserById(company.owner_id);
  const to = owner.user?.email;
  if (!to) return { ok: false, error: "Owner has no email on file." };

  const result = await sendAdminMessageEmail({ to, subject, body });
  await logAudit(actor, {
    action: "company.email",
    targetType: "company",
    targetId: input.companyId,
    detail: { to, subject, delivered: result.ok, skipped: result.skipped ?? false },
  });

  if (result.skipped) {
    return { ok: true, message: "Logged. Email provider isn't configured, so nothing was sent." };
  }
  if (!result.ok) return { ok: false, error: "Email failed to send." };
  return { ok: true, message: `Emailed ${to}.` };
}

/* -------------------------------------------------------------------------- */
/*  Reports                                                                    */
/* -------------------------------------------------------------------------- */

export async function resolveReport(
  id: string,
  status: "reviewed" | "dismissed" | "open",
): Promise<Result> {
  const actor = await requireAdmin();
  if (!["reviewed", "dismissed", "open"].includes(status)) {
    return { ok: false, error: "Bad status." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("company_reports")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, {
    action: "report.resolve",
    targetType: "company_report",
    targetId: id,
    detail: { status },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Jobs / users                                                              */
/* -------------------------------------------------------------------------- */

export async function adminDeleteJob(id: string): Promise<Result> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, { action: "job.delete", targetType: "job", targetId: id });
  revalidatePath("/admin");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function adminDeleteUser(id: string): Promise<Result> {
  const actor = await requireAdmin();
  if (actor.id === id) {
    return { ok: false, error: "You can't delete your own account here." };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, { action: "user.delete", targetType: "user", targetId: id });
  revalidatePath("/admin");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Settings — admin allow-list + own password                               */
/* -------------------------------------------------------------------------- */

export async function addAdminEmail(rawEmail: string): Promise<Result> {
  const actor = await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_emails")
    .upsert({ email }, { onConflict: "email" });
  if (error) return { ok: false, error: error.message };

  // If a user with that email already exists, promote them immediately.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const match = (users?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (match) {
    await admin.from("profiles").update({ role: "admin" }).eq("id", match.id);
  }

  await logAudit(actor, {
    action: "admin_email.add",
    targetType: "admin_email",
    targetId: email,
    detail: { promotedExistingUser: Boolean(match) },
  });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: match
      ? `${email} added and promoted to admin.`
      : `${email} added — they'll become admin on next sign-in.`,
  };
}

export async function removeAdminEmail(rawEmail: string): Promise<Result> {
  const actor = await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (email === actor.email) {
    return { ok: false, error: "You can't remove your own admin access." };
  }
  const admin = createAdminClient();
  const { data: all } = await admin.from("admin_emails").select("email");
  if ((all ?? []).length <= 1) {
    return { ok: false, error: "Can't remove the last admin." };
  }
  const { error } = await admin.from("admin_emails").delete().eq("email", email);
  if (error) return { ok: false, error: error.message };

  // Demote any current user with that email (best-effort).
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const match = (users?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (match) {
    await admin.from("profiles").update({ role: null }).eq("id", match.id);
  }

  await logAudit(actor, {
    action: "admin_email.remove",
    targetType: "admin_email",
    targetId: email,
    detail: { demotedExistingUser: Boolean(match) },
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: `${email} removed.` };
}

export async function updateOwnPassword(password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) {
    return { ok: false, error: "Use at least 8 characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Password updated." };
}

/* -------------------------------------------------------------------------- */
/*  Demo data                                                                  */
/* -------------------------------------------------------------------------- */

export async function adminWipeDemo(): Promise<Result> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("companies").delete().is("owner_id", null);
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, { action: "demo.wipe" });
  revalidatePath("/admin");
  revalidatePath("/jobs");
  return { ok: true, message: "Demo data removed." };
}

export async function adminReseedDemo(): Promise<Result> {
  const actor = await requireAdmin();
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

  const idBySlug = new Map(
    (companies ?? []).map((c) => [c.slug as string, c.id as string]),
  );
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

  await logAudit(actor, {
    action: "demo.reseed",
    detail: { companies: companyRows.length, jobs: jobRows.length },
  });
  revalidatePath("/admin");
  revalidatePath("/jobs");
  return {
    ok: true,
    message: `Seeded ${companyRows.length} companies + ${jobRows.length} jobs.`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reviews moderation + seeker CV access                                      */
/* -------------------------------------------------------------------------- */

export async function adminSetReviewStatus(
  id: string,
  status: "visible" | "hidden",
): Promise<Result> {
  const actor = await requireAdmin();
  if (!["visible", "hidden"].includes(status)) {
    return { ok: false, error: "Bad status." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_reviews")
    .update({ status })
    .eq("id", id)
    .select("companies!inner ( slug )")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, {
    action: "review.status",
    targetType: "company_review",
    targetId: id,
    detail: { status },
  });
  const slug = (data as { companies?: { slug?: string } }).companies?.slug;
  revalidatePath("/admin");
  if (slug) revalidatePath(`/companies/${slug}`);
  return { ok: true };
}

export async function adminDeleteReview(id: string): Promise<Result> {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("company_reviews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit(actor, {
    action: "review.delete",
    targetType: "company_review",
    targetId: id,
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Signed URL for a seeker's current CV — admin only. */
export async function adminSeekerCvUrl(
  userId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("seeker_profiles")
    .select("cv_path")
    .eq("profile_id", userId)
    .maybeSingle();
  if (!data?.cv_path) return { ok: false, error: "No CV on file." };

  const signed = await admin.storage
    .from("cvs")
    .createSignedUrl(data.cv_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, error: "Couldn't generate the link." };
  }
  return { ok: true, url: signed.data.signedUrl };
}
