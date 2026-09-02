import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * seeker_profiles / companies round-trips against the hosted DB, as the owning
 * user (RLS enforced). The Server Actions can't run here (no request cookies),
 * so we drive the same table writes directly with signed-in clients.
 */

const stamp = Date.now();
const PASSWORD = "perch-profiles-it-8chars";
const seeker = { email: `it-pf-seeker-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-pf-recruiter-${stamp}@perch.test`, id: "" };

let seekerClient: SupabaseClient;
let recruiterClient: SupabaseClient;
let companyId = "";

async function makeUser(
  email: string,
  role: "seeker" | "recruiter",
): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: role === "seeker" ? "Pat Seeker" : "Dana Boss", role },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return client;
}

beforeAll(async () => {
  seeker.id = await makeUser(seeker.email, "seeker");
  recruiter.id = await makeUser(recruiter.email, "recruiter");
  seekerClient = await signIn(seeker.email);
  recruiterClient = await signIn(recruiter.email);
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiter.id);
  await svc.from("seeker_profiles").delete().eq("profile_id", seeker.id);
  for (const id of [seeker.id, recruiter.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("seeker_profiles round-trip", () => {
  it("inserts, updates, and is publicly readable", async () => {
    const insert = await seekerClient
      .from("seeker_profiles")
      .upsert(
        { profile_id: seeker.id, headline: "Junior dev", skills: ["js"] },
        { onConflict: "profile_id" },
      );
    expect(insert.error).toBeNull();

    const update = await seekerClient
      .from("seeker_profiles")
      .update({ headline: "Mid dev", skills: ["js", "ts"] })
      .eq("profile_id", seeker.id);
    expect(update.error).toBeNull();

    // Public (anon) read — the SELECT policy is `using (true)`.
    const { data } = await anonClient()
      .from("seeker_profiles")
      .select("headline, skills")
      .eq("profile_id", seeker.id)
      .single();
    expect(data?.headline).toBe("Mid dev");
    expect(data?.skills).toEqual(["js", "ts"]);
  });
});

describe("companies round-trip", () => {
  it("creates then updates a company owned by the recruiter", async () => {
    const { data: created, error } = await recruiterClient
      .from("companies")
      .insert({
        owner_id: recruiter.id,
        name: "Boss Co",
        slug: `boss-co-${stamp}`,
        tagline: "We hire",
      })
      .select("id, slug")
      .single();
    expect(error).toBeNull();
    companyId = created!.id;

    const { error: updateError } = await recruiterClient
      .from("companies")
      .update({ tagline: "We hire well", website: "https://boss.example" })
      .eq("id", companyId);
    expect(updateError).toBeNull();
  });

  it("getCompanyBySlug-shaped read returns the company with its published jobs", async () => {
    const svc = serviceClient();
    const jobSlug = `boss-job-${stamp}`;
    const { error: jobError } = await svc.from("jobs").insert({
      slug: jobSlug,
      company_id: companyId,
      title: "Staff Engineer",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "senior",
      salary_min: 100,
      salary_max: 200,
      description: "x".repeat(60),
      status: "published",
    });
    expect(jobError).toBeNull();

    const { data: company } = await svc
      .from("companies")
      .select("id, name, slug, tagline, description, website, logo_path, logo_color")
      .eq("slug", `boss-co-${stamp}`)
      .maybeSingle();
    expect(company?.name).toBe("Boss Co");

    const { data: jobs } = await svc
      .from("jobs")
      .select("slug, status")
      .eq("company_id", companyId)
      .eq("status", "published");
    expect((jobs ?? []).map((j) => j.slug)).toContain(jobSlug);

    await svc.from("jobs").delete().eq("slug", jobSlug);
  });
});
