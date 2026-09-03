import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Phase 6 RLS (migration 0007): company_reports, company suspension hiding jobs,
 * and admin_emails self-management.
 */

const stamp = Date.now();
const PASSWORD = "perch-admin-it-8chars";
const admin = { email: `it-admin-${stamp}@perch.test`, id: "" };
const recruiter = { email: `it-adm-r-${stamp}@perch.test`, id: "", companyId: "" };
const seeker = { email: `it-adm-s-${stamp}@perch.test`, id: "" };
const seekerB = { email: `it-adm-s2-${stamp}@perch.test`, id: "" };

let adminClient: SupabaseClient;
let recruiterClient: SupabaseClient;
let seekerClient: SupabaseClient;
let seekerBClient: SupabaseClient;
let jobId = "";
let reportId = "";

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
  [admin.id, recruiter.id, seeker.id, seekerB.id] = await Promise.all([
    makeUser(admin.email, null),
    makeUser(recruiter.email, "recruiter"),
    makeUser(seeker.email, "seeker"),
    makeUser(seekerB.email, "seeker"),
  ]);

  const svc = serviceClient();
  // Promote the admin: allow-list + profiles.role.
  await svc.from("admin_emails").upsert({ email: admin.email }, { onConflict: "email" });
  await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: company } = await svc
    .from("companies")
    .insert({ owner_id: recruiter.id, name: "Adm Co", slug: `adm-co-${stamp}` })
    .select("id")
    .single();
  recruiter.companyId = company!.id;
  const { data: job } = await svc
    .from("jobs")
    .insert({
      slug: `adm-job-${stamp}`,
      company_id: recruiter.companyId,
      title: "Adm Role",
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

  [adminClient, recruiterClient, seekerClient, seekerBClient] = await Promise.all([
    signIn(admin.email),
    signIn(recruiter.email),
    signIn(seeker.email),
    signIn(seekerB.email),
  ]);
});

afterAll(async () => {
  const svc = serviceClient();
  await svc.from("companies").delete().eq("owner_id", recruiter.id);
  await svc.from("admin_emails").delete().eq("email", admin.email);
  for (const id of [admin.id, recruiter.id, seeker.id, seekerB.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

describe("company_reports RLS", () => {
  it("a signed-in user can report a company", async () => {
    const { data, error } = await seekerClient
      .from("company_reports")
      .insert({
        company_id: recruiter.companyId,
        reporter_id: seeker.id,
        reason: "spam",
        detail: "junk posts",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    reportId = data!.id;
  });

  it("a user cannot forge a report as someone else", async () => {
    const { error } = await seekerBClient.from("company_reports").insert({
      company_id: recruiter.companyId,
      reporter_id: seeker.id,
      reason: "scam",
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("a user sees only their own report; an admin sees it too", async () => {
    const mine = await seekerClient
      .from("company_reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle();
    expect(mine.data?.id).toBe(reportId);

    const other = await seekerBClient
      .from("company_reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle();
    expect(other.data).toBeNull();

    const asAdmin = await adminClient
      .from("company_reports")
      .select("id, status")
      .eq("id", reportId)
      .maybeSingle();
    expect(asAdmin.data?.id).toBe(reportId);
  });

  it("only an admin can change a report's status", async () => {
    const denied = await seekerClient
      .from("company_reports")
      .update({ status: "dismissed" })
      .eq("id", reportId)
      .select("id");
    expect(denied.data ?? []).toHaveLength(0);

    const ok = await adminClient
      .from("company_reports")
      .update({ status: "reviewed" })
      .eq("id", reportId);
    expect(ok.error).toBeNull();
  });
});

describe("company suspension", () => {
  it("hides the company's published jobs from the public board", async () => {
    const before = await anonClient()
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    expect(before.data?.id).toBe(jobId);

    await serviceClient()
      .from("companies")
      .update({ suspended_at: new Date().toISOString(), suspended_reason: "test" })
      .eq("id", recruiter.companyId);

    const during = await anonClient()
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    expect(during.data).toBeNull();

    // The owner still sees it.
    const owner = await recruiterClient
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    expect(owner.data?.id).toBe(jobId);

    await serviceClient()
      .from("companies")
      .update({ suspended_at: null, suspended_reason: null })
      .eq("id", recruiter.companyId);

    const after = await anonClient()
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    expect(after.data?.id).toBe(jobId);
  });

  it("a suspended company can't publish a new job (RLS insert check)", async () => {
    await serviceClient()
      .from("companies")
      .update({ suspended_at: new Date().toISOString(), suspended_reason: "test" })
      .eq("id", recruiter.companyId);

    const { error } = await recruiterClient.from("jobs").insert({
      slug: `adm-job2-${stamp}`,
      company_id: recruiter.companyId,
      title: "Blocked Role",
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
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");

    await serviceClient()
      .from("companies")
      .update({ suspended_at: null, suspended_reason: null })
      .eq("id", recruiter.companyId);
  });
});

describe("admin_emails self-management", () => {
  it("a non-admin cannot read or write admin_emails", async () => {
    const read = await recruiterClient.from("admin_emails").select("email");
    expect(read.error ? true : (read.data ?? []).length === 0).toBe(true);

    const write = await recruiterClient
      .from("admin_emails")
      .insert({ email: `sneak-${stamp}@perch.test` });
    expect(write.error).not.toBeNull();
  });

  it("an admin can read and manage the allow-list", async () => {
    const read = await adminClient.from("admin_emails").select("email");
    expect(read.error).toBeNull();
    expect((read.data ?? []).some((r) => r.email === admin.email)).toBe(true);

    const extra = `extra-${stamp}@perch.test`;
    const add = await adminClient.from("admin_emails").insert({ email: extra });
    expect(add.error).toBeNull();
    const del = await adminClient.from("admin_emails").delete().eq("email", extra);
    expect(del.error).toBeNull();
  });
});
