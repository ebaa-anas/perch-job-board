import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Who may read a seeker's profile (migration 0021).
 *
 * 0001 shipped `seeker profiles are publicly readable ... using (true)`,
 * which made every seeker's headline, location, bio, skills and cv_path
 * readable with nothing but the anon key. 0021 replaces that with the four
 * readers the product actually needs. These tests are the proof — and the
 * guard against the blanket grant being reintroduced by a later migration.
 */

const stamp = Date.now();
const PASSWORD = "perch-vis-it-8chars";

const seeker = { email: `it-vis-s-${stamp}@perch.test`, id: "" };
const openSeeker = { email: `it-vis-os-${stamp}@perch.test`, id: "" };
const hiringRecruiter = { email: `it-vis-hr-${stamp}@perch.test`, id: "" };
const otherRecruiter = { email: `it-vis-or-${stamp}@perch.test`, id: "" };
const nosySeeker = { email: `it-vis-ns-${stamp}@perch.test`, id: "" };

let hiringCompany = "";
let otherCompany = "";
let jobId = "";

let seekerSelf: SupabaseClient;
let hiringClient: SupabaseClient;
let otherClient: SupabaseClient;
let nosyClient: SupabaseClient;

async function makeUser(email: string, role: "seeker" | "recruiter") {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: email, role },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(email: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

beforeAll(async () => {
  [seeker.id, openSeeker.id, hiringRecruiter.id, otherRecruiter.id, nosySeeker.id] =
    await Promise.all([
      makeUser(seeker.email, "seeker"),
      makeUser(openSeeker.email, "seeker"),
      makeUser(hiringRecruiter.email, "recruiter"),
      makeUser(otherRecruiter.email, "recruiter"),
      makeUser(nosySeeker.email, "seeker"),
    ]);

  const svc = serviceClient();

  const companies = await svc
    .from("companies")
    .insert([
      { owner_id: hiringRecruiter.id, name: `Vis Hire ${stamp}`, slug: `vis-hire-${stamp}` },
      { owner_id: otherRecruiter.id, name: `Vis Other ${stamp}`, slug: `vis-other-${stamp}` },
    ])
    .select("id, owner_id");
  if (companies.error) throw new Error(companies.error.message);
  hiringCompany = companies.data!.find((c) => c.owner_id === hiringRecruiter.id)!.id;
  otherCompany = companies.data!.find((c) => c.owner_id === otherRecruiter.id)!.id;

  const job = await svc
    .from("jobs")
    .insert({
      company_id: hiringCompany,
      title: `Vis Role ${stamp}`,
      slug: `vis-role-${stamp}`,
      location: "Istanbul",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 1,
      salary_max: 2,
      description: "d",
      responsibilities: ["r"],
      requirements: ["q"],
      tags: ["t"],
      status: "published",
    })
    .select("id")
    .single();
  if (job.error) throw new Error(job.error.message);
  jobId = job.data!.id;

  await svc.from("seeker_profiles").insert([
    { profile_id: seeker.id, headline: "Applied seeker", skills: ["react"] },
    { profile_id: openSeeker.id, headline: "Open seeker", skills: ["docker"] },
    { profile_id: nosySeeker.id, headline: "Nosy seeker", skills: [] },
  ]);

  // The applied seeker has an application to the hiring company's job.
  await svc.from("applications").insert({ job_id: jobId, seeker_id: seeker.id });

  // The open seeker has opted in to being found; the applied one has not.
  await svc
    .from("seeker_profiles")
    .update({ open_to_work: true })
    .eq("profile_id", openSeeker.id);

  [seekerSelf, hiringClient, otherClient, nosyClient] = await Promise.all([
    signIn(seeker.email),
    signIn(hiringRecruiter.email),
    signIn(otherRecruiter.email),
    signIn(nosySeeker.email),
  ]);
});

afterAll(async () => {
  const svc = serviceClient();
  for (const id of [hiringCompany, otherCompany]) {
    if (id) await svc.from("companies").delete().eq("id", id);
  }
  for (const u of [seeker, openSeeker, hiringRecruiter, otherRecruiter, nosySeeker]) {
    if (u.id) await svc.auth.admin.deleteUser(u.id);
  }
});

describe("seeker_profiles is no longer world-readable", () => {
  it("an anonymous caller sees nothing", async () => {
    const { data } = await anonClient().from("seeker_profiles").select("headline");
    expect(data ?? []).toHaveLength(0);
  });

  it("another seeker cannot read someone else's profile", async () => {
    const { data } = await nosyClient
      .from("seeker_profiles")
      .select("headline")
      .eq("profile_id", seeker.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("a seeker can still read their own", async () => {
    const { data, error } = await seekerSelf
      .from("seeker_profiles")
      .select("headline")
      .eq("profile_id", seeker.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("the hiring team keeps the access the applicants list needs", () => {
  it("a recruiter can read the profile of someone who applied to their job", async () => {
    const { data, error } = await hiringClient
      .from("seeker_profiles")
      .select("headline, skills")
      .eq("profile_id", seeker.id);
    expect(error).toBeNull();
    expect(data?.[0]?.headline).toBe("Applied seeker");
  });

  it("an unrelated recruiter cannot", async () => {
    const { data } = await otherClient
      .from("seeker_profiles")
      .select("headline")
      .eq("profile_id", seeker.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("the applicants embed still resolves for the hiring team", async () => {
    // This is the query `getJobApplicants` runs; if the policy were too tight
    // the embedded profile would come back null and the drawer would empty.
    const { data, error } = await hiringClient
      .from("applications")
      .select("id, profiles ( full_name, seeker_profiles ( headline, skills ) )")
      .eq("job_id", jobId);
    expect(error).toBeNull();
    const row = data?.[0] as unknown as {
      profiles: { seeker_profiles: { headline: string } | null } | null;
    };
    expect(row.profiles?.seeker_profiles?.headline).toBe("Applied seeker");
  });
});

describe("opt-in sourcing", () => {
  it("a seated recruiter can read a seeker who opted in", async () => {
    const { data, error } = await otherClient
      .from("seeker_profiles")
      .select("headline")
      .eq("profile_id", openSeeker.id);
    expect(error).toBeNull();
    expect(data?.[0]?.headline).toBe("Open seeker");
  });

  it("but not one who did not", async () => {
    const { data } = await otherClient
      .from("seeker_profiles")
      .select("headline")
      .eq("profile_id", nosySeeker.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("another seeker cannot browse opted-in candidates", async () => {
    const { data } = await nosyClient.from("open_candidates").select("headline");
    expect(data ?? []).toHaveLength(0);
  });

  it("the sourcing view withholds name, email and cv_path", async () => {
    const { data, error } = await otherClient
      .from("open_candidates")
      .select("*")
      .eq("profile_id", openSeeker.id);
    expect(error).toBeNull();
    const row = data?.[0] ?? {};
    expect(Object.keys(row).sort()).toEqual(
      ["bio", "headline", "location", "open_to_work_at", "profile_id", "skills"].sort(),
    );
  });

  it("opting out again removes them from sourcing", async () => {
    await serviceClient()
      .from("seeker_profiles")
      .update({ open_to_work: false })
      .eq("profile_id", openSeeker.id);

    const { data } = await otherClient
      .from("open_candidates")
      .select("headline")
      .eq("profile_id", openSeeker.id);
    expect(data ?? []).toHaveLength(0);

    // Restore for any later assertions / reruns.
    await serviceClient()
      .from("seeker_profiles")
      .update({ open_to_work: true })
      .eq("profile_id", openSeeker.id);
  });

  it("stamps open_to_work_at when switched on and clears it when switched off", async () => {
    const svc = serviceClient();
    const { data: on } = await svc
      .from("seeker_profiles")
      .select("open_to_work_at")
      .eq("profile_id", openSeeker.id)
      .single();
    expect(on?.open_to_work_at).toBeTruthy();

    await svc
      .from("seeker_profiles")
      .update({ open_to_work: false })
      .eq("profile_id", openSeeker.id);
    const { data: off } = await svc
      .from("seeker_profiles")
      .select("open_to_work_at")
      .eq("profile_id", openSeeker.id)
      .single();
    expect(off?.open_to_work_at).toBeNull();
  });
});

describe("platform-controlled columns are not recruiter-writable", () => {
  it("a recruiter cannot feature their own job", async () => {
    const { error } = await hiringClient
      .from("jobs")
      .update({ featured_until: new Date(Date.now() + 86_400_000).toISOString() })
      .eq("id", jobId);
    expect(error).not.toBeNull();
  });

  it("a recruiter cannot mark their own company verified", async () => {
    const { error } = await hiringClient
      .from("companies")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", hiringCompany);
    expect(error).not.toBeNull();
  });

  it("the platform can still set both", async () => {
    const svc = serviceClient();
    const featured = await svc
      .from("jobs")
      .update({ featured_until: new Date(Date.now() + 86_400_000).toISOString() })
      .eq("id", jobId)
      .select("featured_until");
    expect(featured.error).toBeNull();
    expect(featured.data?.[0]?.featured_until).toBeTruthy();

    const verified = await svc
      .from("companies")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", hiringCompany)
      .select("verified_at");
    expect(verified.error).toBeNull();
    expect(verified.data?.[0]?.verified_at).toBeTruthy();
  });
});
