import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/** Phase 5 write-side RLS for `saved_jobs` (migration 0006). */

const stamp = Date.now();
const PASSWORD = "perch-saved-it-8chars";
const seeker = { email: `it-saved-s-${stamp}@perch.test`, id: "" };
const seekerB = { email: `it-saved-s2-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-saved-r-${stamp}@perch.test`, id: "" };

let seekerClient: SupabaseClient;
let seekerBClient: SupabaseClient;
let recruiterClient: SupabaseClient;
let companyId = "";
let jobId = "";

async function makeUser(email: string, role: "seeker" | "recruiter") {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `IT ${role}`, role },
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
  [seeker.id, seekerB.id, recruiter.id] = await Promise.all([
    makeUser(seeker.email, "seeker"),
    makeUser(seekerB.email, "seeker"),
    makeUser(recruiter.email, "recruiter"),
  ]);
  [seekerClient, seekerBClient, recruiterClient] = await Promise.all([
    signIn(seeker.email),
    signIn(seekerB.email),
    signIn(recruiter.email),
  ]);

  const svc = serviceClient();
  const { data: company } = await svc
    .from("companies")
    .insert({ owner_id: recruiter.id, name: "Saved Co", slug: `saved-co-${stamp}` })
    .select("id")
    .single();
  companyId = company!.id;
  const { data: job } = await svc
    .from("jobs")
    .insert({
      slug: `saved-job-${stamp}`,
      company_id: companyId,
      title: "Saved Role",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 10,
      salary_max: 20,
      description: "x".repeat(60),
      responsibilities: ["r"],
      requirements: ["r"],
      tags: ["t"],
      status: "published",
    })
    .select("id")
    .single();
  jobId = job!.id;
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiter.id);
  for (const id of [seeker.id, seekerB.id, recruiter.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("saved_jobs RLS", () => {
  it("a seeker can save and unsave a job", async () => {
    const save = await seekerClient
      .from("saved_jobs")
      .upsert({ seeker_id: seeker.id, job_id: jobId }, { onConflict: "seeker_id,job_id" });
    expect(save.error).toBeNull();

    const { data } = await seekerClient
      .from("saved_jobs")
      .select("job_id")
      .eq("seeker_id", seeker.id);
    expect((data ?? []).map((r) => r.job_id)).toContain(jobId);

    const del = await seekerClient
      .from("saved_jobs")
      .delete()
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId);
    expect(del.error).toBeNull();
  });

  it("a seeker cannot save on behalf of another seeker", async () => {
    const { error } = await seekerBClient
      .from("saved_jobs")
      .insert({ seeker_id: seeker.id, job_id: jobId });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("a recruiter cannot save jobs", async () => {
    const { error } = await recruiterClient
      .from("saved_jobs")
      .insert({ seeker_id: recruiter.id, job_id: jobId });
    expect(error).not.toBeNull();
  });

  it("a seeker cannot read another seeker's saved rows", async () => {
    await seekerClient
      .from("saved_jobs")
      .upsert({ seeker_id: seeker.id, job_id: jobId }, { onConflict: "seeker_id,job_id" });
    const { data } = await seekerBClient
      .from("saved_jobs")
      .select("job_id")
      .eq("seeker_id", seeker.id);
    expect(data ?? []).toHaveLength(0);
    await seekerClient.from("saved_jobs").delete().eq("seeker_id", seeker.id);
  });
});
