import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * The matching columns added in 0022.
 *
 * Two things are being proved. First that the columns behave as declared —
 * nullable, three-state, and constrained to the same vocabularies as `jobs`.
 * Second, and more important, that they inherit 0021's read model unchanged:
 * these are more sensitive than a headline, not less, and work authorisation
 * in particular must not become browsable by adding a column to a table.
 */

const stamp = Date.now();
const PASSWORD = "perch-m22-it-8chars";

const seeker = { email: `it-m22-s-${stamp}@perch.test`, id: "" };
const otherSeeker = { email: `it-m22-o-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-m22-r-${stamp}@perch.test`, id: "" };

let companyId = "";
let seekerClient: SupabaseClient;
let otherClient: SupabaseClient;
let recruiterClient: SupabaseClient;

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
  [seeker.id, otherSeeker.id, recruiter.id] = await Promise.all([
    makeUser(seeker.email, "seeker"),
    makeUser(otherSeeker.email, "seeker"),
    makeUser(recruiter.email, "recruiter"),
  ]);

  const svc = serviceClient();
  const company = await svc
    .from("companies")
    .insert({ owner_id: recruiter.id, name: `M22 ${stamp}`, slug: `m22-${stamp}` })
    .select("id")
    .single();
  if (company.error) throw new Error(company.error.message);
  companyId = company.data!.id;

  await svc.from("seeker_profiles").insert([
    { profile_id: seeker.id, headline: "Mobile Developer" },
    { profile_id: otherSeeker.id, headline: "Other" },
  ]);

  [seekerClient, otherClient, recruiterClient] = await Promise.all([
    signIn(seeker.email),
    signIn(otherSeeker.email),
    signIn(recruiter.email),
  ]);
});

afterAll(async () => {
  const svc = serviceClient();
  if (companyId) await svc.from("companies").delete().eq("id", companyId);
  for (const u of [seeker, otherSeeker, recruiter]) {
    if (u.id) await svc.auth.admin.deleteUser(u.id);
  }
});

describe("columns behave as declared", () => {
  it("defaults to not-answered rather than to a value", async () => {
    const { data } = await serviceClient()
      .from("seeker_profiles")
      .select(
        "experience, no_professional_experience, needs_visa_sponsorship, work_authorization, desired_types",
      )
      .eq("profile_id", seeker.id)
      .single();

    expect(data?.experience).toBeNull();
    expect(data?.no_professional_experience).toBeNull();
    expect(data?.needs_visa_sponsorship).toBeNull();
    expect(data?.work_authorization).toBeNull();
    // Arrays default to empty, which means "no preference".
    expect(data?.desired_types).toEqual([]);
  });

  it("a seeker can set their own matching fields", async () => {
    const { error } = await seekerClient
      .from("seeker_profiles")
      .update({
        experience: "mid",
        needs_visa_sponsorship: true,
        work_authorization: "student",
        desired_types: ["full-time", "internship"],
        desired_work_modes: ["remote"],
        desired_locations: ["Istanbul"],
      })
      .eq("profile_id", seeker.id);
    expect(error).toBeNull();
  });

  it("keeps false distinct from null", async () => {
    await seekerClient
      .from("seeker_profiles")
      .update({ needs_visa_sponsorship: false })
      .eq("profile_id", seeker.id);

    const { data } = await serviceClient()
      .from("seeker_profiles")
      .select("needs_visa_sponsorship")
      .eq("profile_id", seeker.id)
      .single();
    expect(data?.needs_visa_sponsorship).toBe(false);
    expect(data?.needs_visa_sponsorship).not.toBeNull();

    // Put it back for the sponsorship read test below.
    await seekerClient
      .from("seeker_profiles")
      .update({ needs_visa_sponsorship: true })
      .eq("profile_id", seeker.id);
  });

  it("rejects an experience value the jobs table would not accept", async () => {
    const { error } = await serviceClient()
      .from("seeker_profiles")
      .update({ experience: "principal" })
      .eq("profile_id", seeker.id);
    expect(error).not.toBeNull();
  });

  it("rejects an unknown work authorization", async () => {
    const { error } = await serviceClient()
      .from("seeker_profiles")
      .update({ work_authorization: "spouse-visa" })
      .eq("profile_id", seeker.id);
    expect(error).not.toBeNull();
  });
});

describe("the new columns inherit 0021's read model", () => {
  it("an anonymous caller still sees nothing", async () => {
    const { data } = await anonClient()
      .from("seeker_profiles")
      .select("needs_visa_sponsorship, work_authorization");
    expect(data ?? []).toHaveLength(0);
  });

  it("another seeker cannot read someone's work authorization", async () => {
    const { data } = await otherClient
      .from("seeker_profiles")
      .select("work_authorization")
      .eq("profile_id", seeker.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("an unrelated recruiter cannot read it either", async () => {
    // No application, and the seeker has not opted in to sourcing.
    const { data } = await recruiterClient
      .from("seeker_profiles")
      .select("work_authorization")
      .eq("profile_id", seeker.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("the seeker can read their own", async () => {
    const { data, error } = await seekerClient
      .from("seeker_profiles")
      .select("work_authorization, needs_visa_sponsorship")
      .eq("profile_id", seeker.id);
    expect(error).toBeNull();
    expect(data?.[0]?.work_authorization).toBe("student");
  });

  it("does not leak the new columns through the sourcing view", async () => {
    // `open_candidates` is the one surface strangers can browse. 0022
    // deliberately did not extend it, and that must stay true.
    await serviceClient()
      .from("seeker_profiles")
      .update({ open_to_work: true })
      .eq("profile_id", seeker.id);

    const { data, error } = await recruiterClient
      .from("open_candidates")
      .select("*")
      .eq("profile_id", seeker.id);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    const row = data![0] as Record<string, unknown>;
    expect(Object.keys(row)).not.toContain("work_authorization");
    expect(Object.keys(row)).not.toContain("needs_visa_sponsorship");
    expect(Object.keys(row)).not.toContain("experience");
  });
});
