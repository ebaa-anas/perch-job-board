import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Phase 12 RLS for company team seats (migration 0018).
 *
 * This file exists because 0018 re-pointed authorisation for the entire app:
 * `owns_company()`, `owns_job()` and `owns_application()` were rewritten in
 * terms of `company_members`, so every policy built on them changed meaning
 * at once. The pre-existing suites prove that did not *regress* the
 * single-recruiter case; nothing proved the new paths worked, or — more
 * importantly — that they had not opened a hole between companies.
 *
 * Every positive assertion is paired with the negative one that would catch
 * an over-permissive policy. A test that only checks "the teammate can read
 * it" would pass just as happily if the table were readable by everyone.
 */

const stamp = Date.now();
const PASSWORD = "perch-team-it-8chars";

const ownerA = { email: `it-team-oa-${stamp}@perch.test`, id: "" };
const seatRecruiter = { email: `it-team-sr-${stamp}@perch.test`, id: "" };
const seatAdmin = { email: `it-team-sa-${stamp}@perch.test`, id: "" };
const outsider = { email: `it-team-out-${stamp}@perch.test`, id: "" };
const invitee = { email: `it-team-inv-${stamp}@perch.test`, id: "" };
const seekerInvitee = { email: `it-team-si-${stamp}@perch.test`, id: "" };
const seekerA = { email: `it-team-ka-${stamp}@perch.test`, id: "" };
const seekerB = { email: `it-team-kb-${stamp}@perch.test`, id: "" };

let companyA = "";
let companyOut = "";
let jobA = "";
let applicationA = "";
let applicationB = "";

let ownerAClient: SupabaseClient;
let seatRecruiterClient: SupabaseClient;
let seatAdminClient: SupabaseClient;
let outsiderClient: SupabaseClient;
let inviteeClient: SupabaseClient;
let seekerInviteeClient: SupabaseClient;
let seekerAClient: SupabaseClient;
let seekerBClient: SupabaseClient;

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

/** Seat someone directly, bypassing the invite flow. */
async function seat(companyId: string, profileId: string, role: string) {
  const { error } = await serviceClient()
    .from("company_members")
    .insert({ company_id: companyId, profile_id: profileId, role });
  if (error) throw new Error(`seat ${role}: ${error.message}`);
}

beforeAll(async () => {
  [
    ownerA.id,
    seatRecruiter.id,
    seatAdmin.id,
    outsider.id,
    invitee.id,
    seekerInvitee.id,
    seekerA.id,
    seekerB.id,
  ] = await Promise.all([
    makeUser(ownerA.email, "recruiter"),
    makeUser(seatRecruiter.email, "recruiter"),
    makeUser(seatAdmin.email, "recruiter"),
    makeUser(outsider.email, "recruiter"),
    makeUser(invitee.email, "recruiter"),
    makeUser(seekerInvitee.email, "seeker"),
    makeUser(seekerA.email, "seeker"),
    makeUser(seekerB.email, "seeker"),
  ]);

  const svc = serviceClient();

  const { data: a, error: aErr } = await svc
    .from("companies")
    .insert({ owner_id: ownerA.id, name: `Team Co ${stamp}`, slug: `team-co-${stamp}` })
    .select("id")
    .single();
  if (aErr) throw new Error(aErr.message);
  companyA = a!.id;

  const { data: o, error: oErr } = await svc
    .from("companies")
    .insert({
      owner_id: outsider.id,
      name: `Out Co ${stamp}`,
      slug: `out-co-${stamp}`,
    })
    .select("id")
    .single();
  if (oErr) throw new Error(oErr.message);
  companyOut = o!.id;

  await seat(companyA, seatRecruiter.id, "recruiter");
  await seat(companyA, seatAdmin.id, "admin");

  const { data: job, error: jobErr } = await svc
    .from("jobs")
    .insert({
      company_id: companyA,
      title: `Team Role ${stamp}`,
      slug: `team-role-${stamp}`,
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
  if (jobErr) throw new Error(jobErr.message);
  jobA = job!.id;

  const { data: apps, error: appErr } = await svc
    .from("applications")
    .insert([
      { job_id: jobA, seeker_id: seekerA.id },
      { job_id: jobA, seeker_id: seekerB.id },
    ])
    .select("id, seeker_id");
  if (appErr) throw new Error(appErr.message);
  applicationA = apps!.find((r) => r.seeker_id === seekerA.id)!.id;
  applicationB = apps!.find((r) => r.seeker_id === seekerB.id)!.id;

  [
    ownerAClient,
    seatRecruiterClient,
    seatAdminClient,
    outsiderClient,
    inviteeClient,
    seekerInviteeClient,
    seekerAClient,
    seekerBClient,
  ] = await Promise.all([
    signIn(ownerA.email),
    signIn(seatRecruiter.email),
    signIn(seatAdmin.email),
    signIn(outsider.email),
    signIn(invitee.email),
    signIn(seekerInvitee.email),
    signIn(seekerA.email),
    signIn(seekerB.email),
  ]);
});

afterAll(async () => {
  const svc = serviceClient();
  for (const id of [companyA, companyOut]) {
    if (id) await svc.from("companies").delete().eq("id", id);
  }
  for (const user of [
    ownerA,
    seatRecruiter,
    seatAdmin,
    outsider,
    invitee,
    seekerInvitee,
    seekerA,
    seekerB,
  ]) {
    if (user.id) await svc.auth.admin.deleteUser(user.id);
  }
});

/* -------------------------------------------------------------------------- */

describe("company creation seats the owner", () => {
  it("creates an owner membership by trigger", async () => {
    const { data } = await serviceClient()
      .from("company_members")
      .select("role")
      .eq("company_id", companyA)
      .eq("profile_id", ownerA.id)
      .maybeSingle();
    expect(data?.role).toBe("owner");
  });

  it("refuses a second company to someone who already holds a seat", async () => {
    // `has_company_seat()` in the companies INSERT policy. Without it the
    // owner-member trigger would lose the one-seat-per-person race and leave
    // a company nobody could administer.
    const { error } = await seatRecruiterClient
      .from("companies")
      .insert({
        owner_id: seatRecruiter.id,
        name: `Nope ${stamp}`,
        slug: `nope-${stamp}`,
      });
    expect(error).not.toBeNull();
  });
});

describe("a plain recruiter seat can do the hiring work", () => {
  it("reads the team's jobs, including ones it did not create", async () => {
    const { data, error } = await seatRecruiterClient
      .from("jobs")
      .select("id")
      .eq("id", jobA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("reads applicants for a team job", async () => {
    const { data, error } = await seatRecruiterClient
      .from("applications")
      .select("id")
      .eq("job_id", jobA);
    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  it("moves an applicant's stage", async () => {
    const { error } = await seatRecruiterClient
      .from("application_pipeline")
      .update({ stage: "reviewed" })
      .eq("application_id", applicationA);
    expect(error).toBeNull();

    const { data } = await serviceClient()
      .from("application_pipeline")
      .select("stage")
      .eq("application_id", applicationA)
      .single();
    expect(data?.stage).toBe("reviewed");
  });

  it("cannot edit the company profile", async () => {
    const { data } = await seatRecruiterClient
      .from("companies")
      .update({ tagline: "plain seat was here" })
      .eq("id", companyA)
      .select("id");
    // RLS filters the row out rather than erroring, so nothing is updated.
    expect(data ?? []).toHaveLength(0);
  });
});

describe("an admin seat can manage the company", () => {
  it("edits the company profile", async () => {
    const { data, error } = await seatAdminClient
      .from("companies")
      .update({ tagline: "admin seat was here" })
      .eq("id", companyA)
      .select("tagline");
    expect(error).toBeNull();
    expect(data?.[0]?.tagline).toBe("admin seat was here");
  });

  it("cannot change the owner's role", async () => {
    const { data } = await seatAdminClient
      .from("company_members")
      .update({ role: "recruiter" })
      .eq("company_id", companyA)
      .eq("profile_id", ownerA.id)
      .select("profile_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot remove the owner", async () => {
    const { data } = await seatAdminClient
      .from("company_members")
      .delete()
      .eq("company_id", companyA)
      .eq("profile_id", ownerA.id)
      .select("profile_id");
    expect(data ?? []).toHaveLength(0);

    const { count } = await serviceClient()
      .from("company_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("company_id", companyA)
      .eq("profile_id", ownerA.id);
    expect(count).toBe(1);
  });
});

describe("company boundaries hold against an outsider", () => {
  it("an outsider recruiter cannot read the team's jobs", async () => {
    const { data } = await outsiderClient.from("jobs").select("id").eq("id", jobA);
    // The job is published, so it is publicly readable; what must not leak is
    // write access and the applicant list below.
    expect(data).toHaveLength(1);
  });

  it("an outsider cannot read the team's applicants", async () => {
    const { data } = await outsiderClient
      .from("applications")
      .select("id")
      .eq("job_id", jobA);
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot read the team's pipeline rows", async () => {
    const { data } = await outsiderClient
      .from("application_pipeline")
      .select("application_id")
      .eq("application_id", applicationA);
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot move a stage", async () => {
    const { data } = await outsiderClient
      .from("application_pipeline")
      .update({ stage: "hired" })
      .eq("application_id", applicationA)
      .select("application_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot read the team's membership", async () => {
    const { data } = await outsiderClient
      .from("company_members")
      .select("profile_id")
      .eq("company_id", companyA);
    expect(data ?? []).toHaveLength(0);
  });

  it("an outsider cannot read the team's job views", async () => {
    await serviceClient()
      .from("job_views")
      .upsert({ job_id: jobA, day: "2026-03-01", views: 5 });
    const { data } = await outsiderClient
      .from("job_views")
      .select("views")
      .eq("job_id", jobA);
    expect(data ?? []).toHaveLength(0);
  });

  it("the team can read its own job views", async () => {
    const { data, error } = await seatRecruiterClient
      .from("job_views")
      .select("views")
      .eq("job_id", jobA);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});

describe("teammates can see each other", () => {
  it("a seat holder reads the full membership list", async () => {
    const { data, error } = await seatRecruiterClient
      .from("company_members")
      .select("profile_id, role")
      .eq("company_id", companyA);
    expect(error).toBeNull();
    expect(data?.length).toBe(3);
  });

  it("a member can remove themselves", async () => {
    const { error } = await seatRecruiterClient
      .from("company_members")
      .delete()
      .eq("company_id", companyA)
      .eq("profile_id", seatRecruiter.id);
    expect(error).toBeNull();

    const { count } = await serviceClient()
      .from("company_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("profile_id", seatRecruiter.id);
    expect(count).toBe(0);
  });

  it("losing the seat ends access to the applicants", async () => {
    const { data } = await seatRecruiterClient
      .from("applications")
      .select("id")
      .eq("job_id", jobA);
    expect(data ?? []).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */

describe("invitations", () => {
  const token = `tok-${stamp}-ok`;
  const wrongToken = `tok-${stamp}-wrong`;
  const seekerToken = `tok-${stamp}-seeker`;

  it("a manager can create an invite", async () => {
    const { error } = await seatAdminClient.from("company_invites").insert({
      company_id: companyA,
      email: invitee.email,
      role: "recruiter",
      token,
      invited_by: seatAdmin.id,
    });
    expect(error).toBeNull();
  });

  it("an outsider cannot create an invite into someone else's company", async () => {
    const { error } = await outsiderClient.from("company_invites").insert({
      company_id: companyA,
      email: `nope-${stamp}@perch.test`,
      role: "admin",
      token: `tok-${stamp}-out`,
      invited_by: outsider.id,
    });
    expect(error).not.toBeNull();
  });

  it("refuses a token addressed to a different email", async () => {
    await serviceClient().from("company_invites").insert({
      company_id: companyA,
      email: `someone-else-${stamp}@perch.test`,
      role: "recruiter",
      token: wrongToken,
      invited_by: seatAdmin.id,
    });
    const { data } = await inviteeClient.rpc("accept_company_invite", {
      p_token: wrongToken,
    });
    expect(data).toBe("wrong_email");
  });

  it("refuses an unknown token", async () => {
    const { data } = await inviteeClient.rpc("accept_company_invite", {
      p_token: "does-not-exist",
    });
    expect(data).toBe("not_found");
  });

  it("refuses a seeker account", async () => {
    await serviceClient().from("company_invites").insert({
      company_id: companyA,
      email: seekerInvitee.email,
      role: "recruiter",
      token: seekerToken,
      invited_by: seatAdmin.id,
    });
    const { data } = await seekerInviteeClient.rpc("accept_company_invite", {
      p_token: seekerToken,
    });
    expect(data).toBe("not_recruiter");
  });

  it("accepts a valid invitation and seats the invitee", async () => {
    const { data, error } = await inviteeClient.rpc("accept_company_invite", {
      p_token: token,
    });
    expect(error).toBeNull();
    expect(data).toBe("ok");

    const { data: member } = await serviceClient()
      .from("company_members")
      .select("role")
      .eq("company_id", companyA)
      .eq("profile_id", invitee.id)
      .maybeSingle();
    expect(member?.role).toBe("recruiter");
  });

  it("gives the new member access to the applicants", async () => {
    const { data, error } = await inviteeClient
      .from("applications")
      .select("id")
      .eq("job_id", jobA);
    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  it("refuses the same token twice", async () => {
    const { data } = await inviteeClient.rpc("accept_company_invite", {
      p_token: token,
    });
    expect(data).toBe("already_accepted");
  });
});

/* -------------------------------------------------------------------------- */

describe("a candidate sees their own application and no one else's", () => {
  it("reads their own pipeline row", async () => {
    const { data, error } = await seekerAClient
      .from("application_pipeline")
      .select("stage")
      .eq("application_id", applicationA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("cannot read another candidate's pipeline row", async () => {
    const { data } = await seekerAClient
      .from("application_pipeline")
      .select("stage")
      .eq("application_id", applicationB);
    expect(data ?? []).toHaveLength(0);
  });

  it("while the other candidate can read theirs, so the block above is scoping", async () => {
    // Without this, "seekerA sees nothing" would pass just as well if the
    // table were unreadable by every candidate — which would be a bug, not a
    // boundary.
    const { data, error } = await seekerBClient
      .from("application_pipeline")
      .select("stage")
      .eq("application_id", applicationB);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("cannot move their own stage", async () => {
    const { data } = await seekerAClient
      .from("application_pipeline")
      .update({ stage: "hired" })
      .eq("application_id", applicationA)
      .select("application_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("sees a shared event but not an internal note", async () => {
    const svc = serviceClient();
    await svc.from("application_events").insert([
      {
        application_id: applicationA,
        actor_id: ownerA.id,
        kind: "stage_change",
        from_stage: "applied",
        to_stage: "reviewed",
        visibility: "seeker",
      },
      {
        application_id: applicationA,
        actor_id: ownerA.id,
        kind: "note",
        body: "internal only",
        visibility: "internal",
      },
    ]);

    const { data } = await seekerAClient
      .from("application_events")
      .select("kind, visibility, body")
      .eq("application_id", applicationA);

    expect(data?.length).toBe(1);
    expect(data?.[0].visibility).toBe("seeker");
    expect(data?.map((e) => e.body)).not.toContain("internal only");
  });

  it("the hiring team sees both", async () => {
    const { data, error } = await ownerAClient
      .from("application_events")
      .select("kind")
      .eq("application_id", applicationA);
    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  it("a candidate cannot forge an event on their own application", async () => {
    const { error } = await seekerAClient.from("application_events").insert({
      application_id: applicationA,
      actor_id: seekerA.id,
      kind: "stage_change",
      to_stage: "offer",
      visibility: "seeker",
    });
    expect(error).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe("ownership transfer", () => {
  // Last, because it rearranges company A's seats.
  it("refuses a caller who is not the owner", async () => {
    const { data } = await seatAdminClient.rpc("transfer_company_ownership", {
      p_company: companyA,
      p_to: invitee.id,
    });
    expect(data).toBe("not_owner");
  });

  it("refuses a target who holds no seat", async () => {
    const { data } = await ownerAClient.rpc("transfer_company_ownership", {
      p_company: companyA,
      p_to: outsider.id,
    });
    expect(data).toBe("not_a_member");
  });

  it("hands ownership over without tripping the single-owner index", async () => {
    // The index is a partial UNIQUE on (company_id) WHERE role = 'owner'.
    // Moving both rows in one UPDATE could leave two owners transiently and
    // fail on row order, which is why the function demotes before promoting.
    const { data, error } = await ownerAClient.rpc("transfer_company_ownership", {
      p_company: companyA,
      p_to: seatAdmin.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("ok");
  });

  it("leaves exactly one owner, and it is the new one", async () => {
    const { data } = await serviceClient()
      .from("company_members")
      .select("profile_id, role")
      .eq("company_id", companyA)
      .eq("role", "owner");
    expect(data).toHaveLength(1);
    expect(data?.[0].profile_id).toBe(seatAdmin.id);
  });

  it("demotes the previous owner to admin", async () => {
    const { data } = await serviceClient()
      .from("company_members")
      .select("role")
      .eq("company_id", companyA)
      .eq("profile_id", ownerA.id)
      .single();
    expect(data?.role).toBe("admin");
  });

  it("keeps companies.owner_id in step", async () => {
    const { data } = await serviceClient()
      .from("companies")
      .select("owner_id")
      .eq("id", companyA)
      .single();
    expect(data?.owner_id).toBe(seatAdmin.id);
  });

  it("enforces one owner per company at the index level", async () => {
    // The invariant `transfer_company_ownership` has to respect. Asserted
    // directly so that dropping `company_members_single_owner_idx` fails here
    // rather than silently allowing two owners.
    const { error } = await serviceClient()
      .from("company_members")
      .insert({ company_id: companyA, profile_id: invitee.id, role: "owner" });
    expect(error?.code).toBe("23505");
  });

  it("can be handed back again", async () => {
    // Exercises the function a second time, with the roles reversed, so the
    // demote-then-promote order is covered in both directions rather than
    // only from the state the trigger happened to create.
    const newOwnerClient = seatAdminClient;
    const { data, error } = await newOwnerClient.rpc("transfer_company_ownership", {
      p_company: companyA,
      p_to: ownerA.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("ok");

    const { data: owners } = await serviceClient()
      .from("company_members")
      .select("profile_id")
      .eq("company_id", companyA)
      .eq("role", "owner");
    expect(owners).toHaveLength(1);
    expect(owners?.[0].profile_id).toBe(ownerA.id);
  });
});
