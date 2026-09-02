import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Phase 4 write-side RLS for `applications` (migration 0005). A recruiter with a
 * published + a draft job, two seekers, and a second recruiter; assert insert
 * gating (role, published-only, own cv folder), the unique constraint, and the
 * applicant/job-owner read scope.
 */

const stamp = Date.now();
const PASSWORD = "perch-apps-it-8chars";
const recruiter = { email: `it-app-r-${stamp}@perch.test`, id: "", companyId: "" };
const recruiterB = { email: `it-app-r2-${stamp}@perch.test`, id: "" };
const seeker = { email: `it-app-s-${stamp}@perch.test`, id: "" };
const seekerB = { email: `it-app-s2-${stamp}@perch.test`, id: "" };

let seekerClient: SupabaseClient;
let seekerBClient: SupabaseClient;
let recruiterClient: SupabaseClient;
let recruiterBClient: SupabaseClient;
let publishedJobId = "";
let draftJobId = "";
let applicationId = "";

async function makeUser(email: string, role: "recruiter" | "seeker") {
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
function jobRow(companyId: string, slug: string, status: string) {
  return {
    slug,
    company_id: companyId,
    title: `Role ${slug}`,
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
    status,
  };
}

beforeAll(async () => {
  [recruiter.id, recruiterB.id, seeker.id, seekerB.id] = await Promise.all([
    makeUser(recruiter.email, "recruiter"),
    makeUser(recruiterB.email, "recruiter"),
    makeUser(seeker.email, "seeker"),
    makeUser(seekerB.email, "seeker"),
  ]);

  [recruiterClient, recruiterBClient, seekerClient, seekerBClient] =
    await Promise.all([
      signIn(recruiter.email),
      signIn(recruiterB.email),
      signIn(seeker.email),
      signIn(seekerB.email),
    ]);

  const svc = serviceClient();
  const { data: company } = await svc
    .from("companies")
    .insert({ owner_id: recruiter.id, name: "App Co", slug: `app-co-${stamp}` })
    .select("id")
    .single();
  recruiter.companyId = company!.id;

  const { data: pub } = await svc
    .from("jobs")
    .insert(jobRow(recruiter.companyId, `pub-${stamp}`, "published"))
    .select("id")
    .single();
  publishedJobId = pub!.id;
  const { data: draft } = await svc
    .from("jobs")
    .insert(jobRow(recruiter.companyId, `draft-${stamp}`, "draft"))
    .select("id")
    .single();
  draftJobId = draft!.id;

  // seeker has a profile with a headline; seekerB does not.
  await seekerClient
    .from("seeker_profiles")
    .upsert({ profile_id: seeker.id, headline: "Engineer" }, { onConflict: "profile_id" });
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiter.id);
  await svc.from("seeker_profiles").delete().eq("profile_id", seeker.id);
  for (const id of [recruiter.id, recruiterB.id, seeker.id, seekerB.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("applications insert gating", () => {
  it("a seeker can apply to a published job", async () => {
    const { data, error } = await seekerClient
      .from("applications")
      .insert({ job_id: publishedJobId, seeker_id: seeker.id, note: "hi" })
      .select("id")
      .single();
    expect(error).toBeNull();
    applicationId = data!.id;
  });

  it("the unique constraint rejects a duplicate application", async () => {
    const { error } = await seekerClient
      .from("applications")
      .insert({ job_id: publishedJobId, seeker_id: seeker.id });
    expect(error?.code).toBe("23505");
  });

  it("a seeker cannot apply to a draft job", async () => {
    const { error } = await seekerBClient
      .from("applications")
      .insert({ job_id: draftJobId, seeker_id: seekerB.id });
    expect(error?.code).toBe("42501");
  });

  it("a seeker cannot forge an application as another seeker", async () => {
    const { error } = await seekerBClient
      .from("applications")
      .insert({ job_id: publishedJobId, seeker_id: seeker.id });
    expect(error).not.toBeNull();
  });

  it("a recruiter cannot insert an application", async () => {
    const { error } = await recruiterClient
      .from("applications")
      .insert({ job_id: publishedJobId, seeker_id: recruiter.id });
    expect(error).not.toBeNull();
  });

  it("a seeker cannot attach a cv_path outside their own folder", async () => {
    const { error } = await seekerBClient.from("applications").insert({
      job_id: publishedJobId,
      seeker_id: seekerB.id,
      cv_path: `${seeker.id}/stolen.pdf`,
    });
    expect(error?.code).toBe("42501");
  });
});

describe("applications read scope", () => {
  it("the applicant can read their own application", async () => {
    const { data } = await seekerClient
      .from("applications")
      .select("id, note")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data?.note).toBe("hi");
  });

  it("the job owner can read the application", async () => {
    const { data } = await recruiterClient
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data?.id).toBe(applicationId);
  });

  it("an unrelated recruiter cannot read the application", async () => {
    const { data } = await recruiterBClient
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("another seeker cannot read the application", async () => {
    const { data } = await seekerBClient
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();
    expect(data).toBeNull();
  });
});

describe("applications withdraw", () => {
  it("the applicant can delete their own application", async () => {
    const { error } = await seekerClient
      .from("applications")
      .delete()
      .eq("id", applicationId);
    expect(error).toBeNull();

    const { count } = await serviceClient()
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("id", applicationId);
    expect(count).toBe(0);
  });
});
