"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { rateLimitSubject } from "@/lib/rate-limit";
import { reviewSchema, type ReviewValues } from "@/features/companies/schema";
import { crossesDemoBoundary, isDemoMode, isDemoUser } from "@/features/demo/demo-rules";
import { companyOwnerEmail, demoBlocked } from "@/features/demo/server";

type Result = { ok: boolean; error?: string };

export async function upsertReview(
  companyId: string,
  values: ReviewValues,
): Promise<Result> {
  const profile = await requireRole("seeker");
  if (!(await rateLimitSubject("review", profile.id))) {
    return { ok: false, error: "You've posted several reviews just now. Try again later." };
  }
  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("owner_id, slug")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: "Company not found." };
  if (company.owner_id === profile.id) {
    return { ok: false, error: "You can't review your own company." };
  }
  // Reviews go live immediately and in public. From a login anyone can borrow
  // they would be anonymous posts about real employers, so demo accounts stay
  // on demo companies — and real people do not review the fictional ones.
  if (isDemoMode() && crossesDemoBoundary(profile.email, await companyOwnerEmail(companyId))) {
    return {
      ok: false,
      error: await demoBlocked(isDemoUser(profile.email) ? "demoOnly" : "demoListing"),
    };
  }

  const { error } = await supabase.from("company_reviews").upsert(
    {
      company_id: companyId,
      reviewer_id: profile.id,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,reviewer_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/companies/${company.slug}`);
  return { ok: true };
}

export async function deleteOwnReview(companyId: string): Promise<Result> {
  const profile = await requireRole("seeker");
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .maybeSingle();
  const { error } = await supabase
    .from("company_reviews")
    .delete()
    .eq("company_id", companyId)
    .eq("reviewer_id", profile.id);
  if (error) return { ok: false, error: error.message };
  if (company?.slug) revalidatePath(`/companies/${company.slug}`);
  return { ok: true };
}
