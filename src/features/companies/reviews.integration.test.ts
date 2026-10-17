import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/** Phase 7 RLS for company_reviews (migration 0009). */

const stamp = Date.now();
const PASSWORD = "perch-rev-it-8chars";
const seeker = { email: `it-rev-s-${stamp}@perch.test`, id: "" };
const seekerB = { email: `it-rev-s2-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-rev-r-${stamp}@perch.test`, id: "", companyId: "" };
const admin = { email: `it-rev-a-${stamp}@perch.test`, id: "" };

let seekerClient: SupabaseClient;
let seekerBClient: SupabaseClient;
let recruiterClient: SupabaseClient;
let adminClient: SupabaseClient;
let reviewId = "";

async function makeUser(email: string, role: "seeker" | "recruiter" | null) {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: role ? { full_name: email, role } : { full_name: email },
  });
  if (error) throw new Error(error.message);
  return data.user.id;
}
async function signIn(email: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  return c;
}

beforeAll(async () => {
  [seeker.id, seekerB.id, recruiter.id, admin.id] = await Promise.all([
    makeUser(seeker.email, "seeker"),
    makeUser(seekerB.email, "seeker"),
    makeUser(recruiter.email, "recruiter"),
    makeUser(admin.email, null),
  ]);
  const svc = serviceClient();
  await svc.from("admin_emails").upsert({ email: admin.email }, { onConflict: "email" });
  await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  const { data: c } = await svc
    .from("companies")
    .insert({ owner_id: recruiter.id, name: `Rev Co ${stamp}`, slug: `rev-co-${stamp}` })
    .select("id")
    .single();
  recruiter.companyId = c!.id;

  [seekerClient, seekerBClient, recruiterClient, adminClient] = await Promise.all([
    signIn(seeker.email),
    signIn(seekerB.email),
    signIn(recruiter.email),
    signIn(admin.email),
  ]);
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiter.id);
  // Users before the admin_emails row: the other order leaves a moment where
  // an admin profile exists without its listing, which the global invariant
  // in security-hardening.integration.test.ts can observe and fail on.
  for (const id of [seeker.id, seekerB.id, recruiter.id, admin.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
  await svc.from("admin_emails").delete().eq("email", admin.email);
});

describe("company_reviews RLS", () => {
  it("a seeker can review a company they don't own", async () => {
    const { data, error } = await seekerClient
      .from("company_reviews")
      .insert({ company_id: recruiter.companyId, reviewer_id: seeker.id, rating: 4, body: "ok" })
      .select("id")
      .single();
    expect(error).toBeNull();
    reviewId = data!.id;
  });

  it("the unique constraint blocks a second review from the same seeker", async () => {
    const { error } = await seekerClient
      .from("company_reviews")
      .insert({ company_id: recruiter.companyId, reviewer_id: seeker.id, rating: 1 });
    expect(error?.code).toBe("23505");
  });

  it("a recruiter cannot review their own company", async () => {
    const { error } = await recruiterClient
      .from("company_reviews")
      .insert({ company_id: recruiter.companyId, reviewer_id: recruiter.id, rating: 5 });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("a seeker cannot forge a review as someone else", async () => {
    const { error } = await seekerBClient
      .from("company_reviews")
      .insert({ company_id: recruiter.companyId, reviewer_id: seeker.id, rating: 3 });
    expect(error).not.toBeNull();
  });

  it("only an admin can hide a review; the author can't unhide it", async () => {
    const denied = await seekerClient
      .from("company_reviews")
      .update({ status: "hidden" })
      .eq("id", reviewId)
      .select("status")
      .single();
    // trigger silently reverts status for non-admins
    expect(denied.data?.status).toBe("visible");

    const ok = await adminClient
      .from("company_reviews")
      .update({ status: "hidden" })
      .eq("id", reviewId);
    expect(ok.error).toBeNull();

    // author edits body but can't flip status back
    await seekerClient
      .from("company_reviews")
      .update({ status: "visible", body: "edited" })
      .eq("id", reviewId);
    const { data } = await serviceClient()
      .from("company_reviews")
      .select("status, body")
      .eq("id", reviewId)
      .single();
    expect(data?.status).toBe("hidden");
    expect(data?.body).toBe("edited");
  });

  it("a hidden review is invisible to the public but visible to its author", async () => {
    const pub = await anonClient()
      .from("company_reviews")
      .select("id")
      .eq("id", reviewId)
      .maybeSingle();
    expect(pub.data).toBeNull();

    const mine = await seekerClient
      .from("company_reviews")
      .select("id")
      .eq("id", reviewId)
      .maybeSingle();
    expect(mine.data?.id).toBe(reviewId);
  });

  it("the author can delete their own review", async () => {
    const { error } = await seekerClient
      .from("company_reviews")
      .delete()
      .eq("id", reviewId);
    expect(error).toBeNull();
  });
});
