"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { slugify } from "@/lib/slug";
import { companySchema, type CompanyValues } from "@/features/companies/schema";
import { pickFreeSlug } from "@/features/companies/slug";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Find a free slug near `base`, ignoring the row we're updating (`selfId`). */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  selfId: string | null,
): Promise<string> {
  const root = slugify(base) || "company";
  const { data } = await supabase
    .from("companies")
    .select("id, slug")
    .or(`slug.eq.${root},slug.like.${root}-%`);
  const taken = new Set(
    (data ?? [])
      .filter((row) => row.id !== selfId)
      .map((row) => row.slug as string),
  );
  return pickFreeSlug(root, taken);
}

export async function upsertCompany(
  values: CompanyValues,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const profile = await requireRole("recruiter");
  const parsed = companySchema.safeParse(values);
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
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", profile.id)
    .maybeSingle();

  const slug = await uniqueSlug(
    supabase,
    parsed.data.slug || parsed.data.name,
    existing?.id ?? null,
  );

  const row = {
    name: parsed.data.name,
    slug,
    tagline: parsed.data.tagline || null,
    description: parsed.data.description || null,
    website: parsed.data.website || null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("companies")
      .update(row)
      .eq("id", existing.id)
      .select("id, slug")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/company");
    revalidatePath(`/companies/${data.slug}`);
    return { ok: true, data };
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...row, owner_id: profile.id })
    .select("id, slug")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/company");
  revalidatePath(`/companies/${data.slug}`);
  return { ok: true, data };
}

export async function setCompanyLogo(
  path: string,
): Promise<ActionResult<{ path: string }>> {
  const profile = await requireRole("recruiter");
  if (!path.startsWith(`${profile.id}/`)) {
    return { ok: false, error: "That file isn't in your folder." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ logo_path: path })
    .eq("owner_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/company");
  return { ok: true, data: { path } };
}

export async function removeCompanyLogo(): Promise<ActionResult<null>> {
  const profile = await requireRole("recruiter");
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("logo_path")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (company?.logo_path) {
    await supabase.storage.from("logos").remove([company.logo_path]);
  }
  const { error } = await supabase
    .from("companies")
    .update({ logo_path: null })
    .eq("owner_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/company");
  return { ok: true, data: null };
}
