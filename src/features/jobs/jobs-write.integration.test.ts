import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Phase 3 owner-write RLS for `jobs` (migration 0004). Two recruiters each with
 * a company, plus a seeker; assert who can insert / update / delete which job.
 */

const stamp = Date.now();
const PASSWORD = "perch-jobs-it-8chars";
const recruiterA = { email: `it-jobs-a-${stamp}@perch.test`, id: "", companyId: "" };
const recruiterB = { email: `it-jobs-b-${stamp}@perch.test`, id: "", companyId: "" };
const seeker = { email: `it-jobs-s-${stamp}@perch.test`, id: "" };

let clientA: SupabaseClient;
let clientB: SupabaseClient;
let seekerClient: SupabaseClient;
let jobId = "";

async function makeUser(email: string, role: "recruiter" | "seeker") {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: role, role },
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

function jobRow(companyId: string, slug: string, status = "published") {
  return {
    slug,
    company_id: companyId,
    title: "Widget Engineer",
    location: "Remote",
    type: "full-time",
    work_mode: "remote",
    experience: "mid",
    salary_min: 50,
    salary_max: 90,
    description: "x".repeat(60),
    responsibilities: ["ship"],
    requirements: ["experience"],
    tags: ["ts"],
    status,
  };
}

beforeAll(async () => {
  recruiterA.id = await makeUser(recruiterA.email, "recruiter");
  recruiterB.id = await makeUser(recruiterB.email, "recruiter");
  seeker.id = await makeUser(seeker.email, "seeker");
  clientA = await signIn(recruiterA.email);
  clientB = await signIn(recruiterB.email);
  seekerClient = await signIn(seeker.email);

  const svc = serviceClient();
  const { data: ca } = await svc
    .from("companies")
    .insert({ owner_id: recruiterA.id, name: "A Co", slug: `a-co-${stamp}` })
    .select("id")
    .single();
  recruiterA.companyId = ca!.id;
  const { data: cb } = await svc
    .from("companies")
    .insert({ owner_id: recruiterB.id, name: "B Co", slug: `b-co-${stamp}` })
    .select("id")
    .single();
  recruiterB.companyId = cb!.id;
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiterA.id);
  await svc.from("companies").delete().eq("owner_id", recruiterB.id);
  for (const id of [recruiterA.id, recruiterB.id, seeker.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("jobs insert", () => {
  it("a recruiter can insert a job for their own company", async () => {
    const { data, error } = await clientA
      .from("jobs")
      .insert(jobRow(recruiterA.companyId, `a-job-${stamp}`))
      .select("id")
      .single();
    expect(error).toBeNull();
    jobId = data!.id;
  });

  it("a recruiter cannot insert a job for another company", async () => {
    const { error } = await clientB
      .from("jobs")
      .insert(jobRow(recruiterA.companyId, `b-spoof-${stamp}`));
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("a seeker cannot insert a job", async () => {
    const { error } = await seekerClient
      .from("jobs")
      .insert(jobRow(recruiterA.companyId, `s-job-${stamp}`));
    expect(error).not.toBeNull();
  });
});

describe("jobs update / delete", () => {
  it("the owner can change status", async () => {
    const { error } = await clientA
      .from("jobs")
      .update({ status: "closed" })
      .eq("id", jobId);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single();
    expect(data?.status).toBe("closed");
  });

  it("a non-owner recruiter cannot update the job", async () => {
    await clientB.from("jobs").update({ title: "hacked" }).eq("id", jobId);
    const { data } = await serviceClient()
      .from("jobs")
      .select("title")
      .eq("id", jobId)
      .single();
    expect(data?.title).toBe("Widget Engineer");
  });

  it("a non-owner recruiter cannot delete the job", async () => {
    await clientB.from("jobs").delete().eq("id", jobId);
    const { count } = await serviceClient()
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("id", jobId);
    expect(count).toBe(1);
  });

  it("the public (anon) board excludes non-published jobs", async () => {
    const { data } = await anonClient()
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("status", "published");
    expect(data ?? []).toHaveLength(0);
  });

  it("the owner can delete their own job", async () => {
    const { error } = await clientA.from("jobs").delete().eq("id", jobId);
    expect(error).toBeNull();
  });
});
