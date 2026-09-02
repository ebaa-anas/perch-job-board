import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Exercises the Phase 2 write-side RLS (0002) and the role-immutability trigger
 * (0003) against the linked hosted DB. Creates two confirmed users via the admin
 * API, signs in as each, and asserts what they can and cannot write.
 */

const stamp = Date.now();
const PASSWORD = "perch-integration-pw-8chars";

const seeker = { email: `it-seeker-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-recruiter-${stamp}@perch.test`, id: "" };

async function createConfirmedUser(
  email: string,
  role: "seeker" | "recruiter",
  fullName: string,
): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`createUser(${role}) failed: ${error.message}`);
  return data.user.id;
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

let seekerClient: SupabaseClient;
let recruiterClient: SupabaseClient;

beforeAll(async () => {
  seeker.id = await createConfirmedUser(seeker.email, "seeker", "Ivy Seeker");
  recruiter.id = await createConfirmedUser(
    recruiter.email,
    "recruiter",
    "Rick Recruiter",
  );
  seekerClient = await signedInClient(seeker.email);
  recruiterClient = await signedInClient(recruiter.email);
});

afterAll(async () => {
  const svc = serviceClient();
  for (const id of [seeker.id, recruiter.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("handle_new_user trigger", () => {
  it("creates a profiles row with the role from signup metadata", async () => {
    const svc = serviceClient();
    const { data: s } = await svc
      .from("profiles")
      .select("role, full_name")
      .eq("id", seeker.id)
      .single();
    expect(s?.role).toBe("seeker");
    expect(s?.full_name).toBe("Ivy Seeker");

    const { data: r } = await svc
      .from("profiles")
      .select("role")
      .eq("id", recruiter.id)
      .single();
    expect(r?.role).toBe("recruiter");
  });
});

describe("profiles write RLS", () => {
  it("a user can update their own profile", async () => {
    const { data, error } = await seekerClient
      .from("profiles")
      .update({ full_name: "Ivy Renamed" })
      .eq("id", seeker.id)
      .select("full_name");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].full_name).toBe("Ivy Renamed");
  });

  it("a user cannot update someone else's profile", async () => {
    const { data } = await seekerClient
      .from("profiles")
      .update({ full_name: "hacked" })
      .eq("id", recruiter.id)
      .select("full_name");
    expect(data ?? []).toHaveLength(0);

    const { data: check } = await serviceClient()
      .from("profiles")
      .select("full_name")
      .eq("id", recruiter.id)
      .single();
    expect(check?.full_name).toBe("Rick Recruiter");
  });
});

describe("role immutability (0003 trigger)", () => {
  it("a seeker cannot self-promote to admin", async () => {
    await seekerClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", seeker.id)
      .select("role");

    const { data } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", seeker.id)
      .single();
    expect(data?.role).toBe("seeker");
  });

  it("a seeker cannot switch to recruiter", async () => {
    await seekerClient
      .from("profiles")
      .update({ role: "recruiter" })
      .eq("id", seeker.id);

    const { data } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", seeker.id)
      .single();
    expect(data?.role).toBe("seeker");
  });
});

describe("seeker_profiles write RLS", () => {
  afterAll(async () => {
    await serviceClient().from("seeker_profiles").delete().eq("profile_id", seeker.id);
  });

  it("a seeker can insert their own row", async () => {
    const { error } = await seekerClient
      .from("seeker_profiles")
      .insert({ profile_id: seeker.id, headline: "Frontend engineer" });
    expect(error).toBeNull();
  });

  it("a recruiter cannot insert a seeker_profiles row", async () => {
    const { error } = await recruiterClient
      .from("seeker_profiles")
      .insert({ profile_id: recruiter.id });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});

describe("companies write RLS", () => {
  afterAll(async () => {
    await serviceClient().from("companies").delete().eq("owner_id", recruiter.id);
  });

  it("a recruiter can insert exactly one company they own", async () => {
    const { error } = await recruiterClient.from("companies").insert({
      owner_id: recruiter.id,
      name: "Recruiter Co",
      slug: `recruiter-co-${stamp}`,
    });
    expect(error).toBeNull();

    const { error: second } = await recruiterClient.from("companies").insert({
      owner_id: recruiter.id,
      name: "Recruiter Co 2",
      slug: `recruiter-co-2-${stamp}`,
    });
    expect(second).not.toBeNull(); // unique(owner_id)
  });

  it("a seeker cannot insert a company", async () => {
    const { error } = await seekerClient.from("companies").insert({
      owner_id: seeker.id,
      name: "Seeker Co",
      slug: `seeker-co-${stamp}`,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("a recruiter cannot create a company owned by someone else", async () => {
    const { error } = await recruiterClient.from("companies").insert({
      owner_id: seeker.id,
      name: "Spoofed Co",
      slug: `spoofed-co-${stamp}`,
    });
    expect(error).not.toBeNull();
  });
});

describe("admin_emails opacity", () => {
  it("an authenticated non-admin cannot read admin_emails", async () => {
    const { data, error } = await seekerClient.from("admin_emails").select("email");
    // No SELECT policy => either an error or an empty set, never real rows.
    expect(error ? true : (data ?? []).length === 0).toBe(true);
  });
});
