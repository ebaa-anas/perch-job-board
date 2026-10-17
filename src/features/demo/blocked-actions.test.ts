import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeQueries } from "@/test/fake-supabase";

/**
 * What a demo account may not do, checked on the real Server Actions with
 * Supabase and the Next.js plumbing stubbed out. Each refusal is paired with
 * the same call from a real account, so a guard that blocked everyone would
 * fail here as surely as one that blocked no one.
 */

const h = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    RedirectError,
    profile: null as null | { id: string; email: string; role: string; fullName: string },
    server: null as unknown,
    admin: null as unknown,
    ownerEmail: null as string | null,
    rateLimitRequest: vi.fn(async () => true),
    rateLimitSubject: vi.fn(async () => true),
    email: {
      sendNewApplicantEmail: vi.fn(async () => ({ ok: true })),
      sendApplicationStatusEmail: vi.fn(async () => ({ ok: true })),
      sendTeamInviteEmail: vi.fn(async () => ({ ok: true })),
      sendAdminMessageEmail: vi.fn(async () => ({ ok: true })),
      sendJobAlertEmail: vi.fn(async () => ({ ok: true })),
    },
    createNotification: vi.fn(async () => {}),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.RedirectError(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/features/auth/session", () => ({
  getUser: async () => (h.profile ? { id: h.profile.id, email: h.profile.email } : null),
  getProfile: async () => h.profile,
  requireUser: async () => ({ id: h.profile?.id, email: h.profile?.email }),
  requireRole: async () => h.profile,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitRequest: h.rateLimitRequest,
  rateLimitSubject: h.rateLimitSubject,
}));
vi.mock("@/lib/email", () => h.email);
vi.mock("@/features/notifications/notify", () => ({ createNotification: h.createNotification }));
vi.mock("@/features/team/data", () => ({
  getOwnMembership: async () => ({ companyId: "c-1", role: "owner" }),
}));
vi.mock("@/features/jobs/data", () => ({ getJobQuestions: async () => [] }));
vi.mock("@/features/demo/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/demo/server")>()),
  companyOwnerEmail: async () => h.ownerEmail,
}));

import {
  requestPasswordReset,
  signOut,
  signUp,
  updatePassword,
} from "@/features/auth/actions";
import { updateOwnPassword } from "@/features/admin/actions";
import { deleteMyAccount } from "@/features/privacy/actions";
import { inviteTeamMember } from "@/features/team/actions";
import { applyToJob } from "@/features/applications/actions";
import { setApplicationStage } from "@/features/applications/pipeline-actions";
import { upsertReview } from "@/features/companies/reviews-actions";
import { en } from "@/lib/i18n/dictionaries/en";

const DEMO_SEEKER = { id: "u-ds", email: "demo-seeker@seed.perch.test", role: "seeker", fullName: "Deniz Aksoy" };
const DEMO_RECRUITER = { id: "u-dr", email: "demo-recruiter@seed.perch.test", role: "recruiter", fullName: "Selin Arslan" };
const REAL_SEEKER = { id: "u-rs", email: "seeker@example.com", role: "seeker", fullName: "Real Seeker" };
const REAL_RECRUITER = { id: "u-rr", email: "recruiter@example.com", role: "recruiter", fullName: "Real Recruiter" };

const APPLICATION_ID = "5b0f3c1e-8d7a-4a51-9a3e-2b6c4d8e9f10";

/** Lets fire-and-forget notifications (`void notify…()`) settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function serverClient(results: Parameters<typeof fakeQueries>[0] = {}) {
  const queries = fakeQueries(results);
  const auth = {
    updateUser: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: h.profile }, error: null })),
  };
  h.server = { from: queries.from, auth };
  return { ...queries, auth };
}

function adminClient(results: Parameters<typeof fakeQueries>[0] = {}) {
  const queries = fakeQueries(results);
  const auth = {
    admin: {
      deleteUser: vi.fn(async () => ({ error: null })),
      getUserById: vi.fn(async () => ({ data: { user: { email: "recruiter@example.com" } } })),
    },
  };
  const storage = { from: vi.fn(() => ({ remove: vi.fn(async () => ({ error: null })) })) };
  h.admin = { from: queries.from, auth, storage };
  return { ...queries, auth, storage };
}

beforeEach(() => {
  h.profile = null;
  h.ownerEmail = null;
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
  for (const send of Object.values(h.email)) send.mockClear();
  h.createNotification.mockClear();
  h.rateLimitRequest.mockClear();
  serverClient();
  adminClient();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("changing a password", () => {
  it("is refused for a demo account", async () => {
    h.profile = DEMO_SEEKER;
    const server = serverClient();

    await expect(updatePassword("a-new-password")).resolves.toEqual({
      error: en.demo.blocked.password,
    });
    expect(server.auth.updateUser).not.toHaveBeenCalled();
  });

  it("still works for a real account", async () => {
    h.profile = REAL_SEEKER;
    const server = serverClient();

    await expect(updatePassword("a-new-password")).rejects.toMatchObject({ url: "/login" });
    expect(server.auth.updateUser).toHaveBeenCalledWith({ password: "a-new-password" });
  });

  it("is refused from the admin console too, even if a demo address were listed", async () => {
    h.profile = { ...DEMO_RECRUITER, role: "admin" };
    const server = serverClient();
    adminClient({ admin_emails: { data: [{ email: DEMO_RECRUITER.email }] } });

    await expect(updateOwnPassword("a-new-password")).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.password,
    });
    expect(server.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("requesting a password reset", () => {
  it("is refused for a demo address, in any case", async () => {
    const server = serverClient();

    await expect(requestPasswordReset("Demo-Seeker@Seed.Perch.Test")).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.reset,
    });
    expect(server.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("still sends for a real address", async () => {
    const server = serverClient();

    await expect(requestPasswordReset("seeker@example.com")).resolves.toEqual({ ok: true });
    expect(server.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "seeker@example.com",
      expect.any(Object),
    );
  });
});

describe("signing up", () => {
  it("refuses the reserved demo domain before spending the rate limit", async () => {
    const server = serverClient();

    await expect(
      signUp({ email: "me@seed.perch.test", password: "long-enough-1", fullName: "Me", role: "seeker" }),
    ).resolves.toEqual({ error: en.demo.blocked.reservedDomain });
    expect(server.auth.signUp).not.toHaveBeenCalled();
    expect(h.rateLimitRequest).not.toHaveBeenCalled();
  });
});

describe("signing out", () => {
  it("ends only this browser's session on a shared demo login", async () => {
    h.profile = DEMO_SEEKER;
    const server = serverClient();

    await expect(signOut()).rejects.toMatchObject({ url: "/" });
    expect(server.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the global sign-out for a real account", async () => {
    h.profile = REAL_SEEKER;
    const server = serverClient();

    await expect(signOut()).rejects.toMatchObject({ url: "/" });
    expect(server.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

describe("deleting the account (KVKK / GDPR erasure)", () => {
  it("is refused for a demo account, and nothing is removed", async () => {
    h.profile = DEMO_SEEKER;
    const admin = adminClient();

    await expect(deleteMyAccount("delete")).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.deleteAccount,
    });
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(admin.storage.from).not.toHaveBeenCalled();
  });

  it("goes on to the normal checks for a real account", async () => {
    h.profile = REAL_SEEKER;

    await expect(deleteMyAccount("not yet")).resolves.toEqual({
      ok: false,
      error: 'Type "delete" to confirm.',
    });
  });
});

describe("inviting a teammate", () => {
  it("is refused for a demo account: no invite row, no email", async () => {
    h.profile = DEMO_RECRUITER;
    const server = serverClient();

    await expect(inviteTeamMember({ email: "friend@example.com", role: "recruiter" })).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.invite,
    });
    expect(server.touched("company_invites")).toBe(false);
    await settle();
    expect(h.email.sendTeamInviteEmail).not.toHaveBeenCalled();
  });

  it("still invites for a real owner", async () => {
    h.profile = REAL_RECRUITER;
    const server = serverClient({ companies: { data: { name: "Acme" } } });

    await expect(inviteTeamMember({ email: "friend@example.com", role: "recruiter" })).resolves.toEqual({
      ok: true,
    });
    expect(server.wrote("company_invites")).toBe(true);
    await settle();
    expect(h.email.sendTeamInviteEmail).toHaveBeenCalledTimes(1);
  });
});

describe("applying across the demo boundary", () => {
  const applyTables = {
    seeker_profiles: { data: { headline: "Engineer", cv_path: null, cv_filename: null } },
    jobs: { data: { id: "j-1", title: "Engineer", status: "published", company_id: "c-1" } },
    applications: { error: null },
  };

  it("keeps a real seeker's application out of a demo company", async () => {
    h.profile = REAL_SEEKER;
    h.ownerEmail = DEMO_RECRUITER.email;
    const server = serverClient(applyTables);

    await expect(applyToJob({ jobId: "j-1" })).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.demoListing,
    });
    expect(server.wrote("applications")).toBe(false);
  });

  it("keeps a demo visitor's application out of a real company", async () => {
    h.profile = DEMO_SEEKER;
    h.ownerEmail = REAL_RECRUITER.email;
    const server = serverClient(applyTables);

    await expect(applyToJob({ jobId: "j-1" })).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.demoOnly,
    });
    expect(server.wrote("applications")).toBe(false);
  });

  it("lets demo apply to demo, without emailing anyone", async () => {
    h.profile = DEMO_SEEKER;
    h.ownerEmail = DEMO_RECRUITER.email;
    const server = serverClient(applyTables);

    await expect(applyToJob({ jobId: "j-1" })).resolves.toEqual({ ok: true });
    expect(server.wrote("applications")).toBe(true);
    await settle();
    expect(h.email.sendNewApplicantEmail).not.toHaveBeenCalled();
  });

  it("never emails a recruiter on a demo visitor's behalf, even with demo mode off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    h.profile = DEMO_SEEKER;
    h.ownerEmail = REAL_RECRUITER.email;
    serverClient(applyTables);
    adminClient({ companies: { data: { owner_id: REAL_RECRUITER.id } } });

    await expect(applyToJob({ jobId: "j-1" })).resolves.toEqual({ ok: true });
    await settle();
    expect(h.email.sendNewApplicantEmail).not.toHaveBeenCalled();
  });

  it("still emails the recruiter for a real applicant", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    h.profile = REAL_SEEKER;
    serverClient(applyTables);
    adminClient({ companies: { data: { owner_id: REAL_RECRUITER.id } } });

    await expect(applyToJob({ jobId: "j-1" })).resolves.toEqual({ ok: true });
    await vi.waitFor(() => expect(h.email.sendNewApplicantEmail).toHaveBeenCalledTimes(1));
  });
});

describe("reviewing across the demo boundary", () => {
  const values = { rating: 4, title: "Good team", body: "Clear process and fast replies." };

  it("keeps a demo visitor's review off a real company", async () => {
    h.profile = DEMO_SEEKER;
    h.ownerEmail = REAL_RECRUITER.email;
    const server = serverClient({ companies: { data: { owner_id: REAL_RECRUITER.id, slug: "acme" } } });

    await expect(upsertReview("c-1", values)).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.demoOnly,
    });
    expect(server.wrote("company_reviews")).toBe(false);
  });

  it("keeps real reviews off the fictional companies", async () => {
    h.profile = REAL_SEEKER;
    h.ownerEmail = DEMO_RECRUITER.email;
    const server = serverClient({ companies: { data: { owner_id: DEMO_RECRUITER.id, slug: "tidewater" } } });

    await expect(upsertReview("c-1", values)).resolves.toEqual({
      ok: false,
      error: en.demo.blocked.demoListing,
    });
    expect(server.wrote("company_reviews")).toBe(false);
  });

  it("allows reviews on the same side of the boundary", async () => {
    h.profile = DEMO_SEEKER;
    h.ownerEmail = DEMO_RECRUITER.email;
    const server = serverClient({
      companies: { data: { owner_id: DEMO_RECRUITER.id, slug: "tidewater" } },
      company_reviews: { error: null },
    });

    await expect(upsertReview("c-1", values)).resolves.toEqual({ ok: true });
    expect(server.wrote("company_reviews")).toBe(true);
  });
});

describe("moving an application through the pipeline", () => {
  const context = {
    applications: {
      data: {
        seeker_id: REAL_SEEKER.id,
        application_pipeline: { stage: "applied", decided_at: null },
        jobs: { id: "j-1", slug: "engineer", title: "Engineer", companies: { name: "Tidewater Studio" } },
      },
    },
    application_pipeline: { error: null },
    application_events: { error: null },
  };

  it("tells the candidate in the product but sends no email from a demo recruiter", async () => {
    h.profile = DEMO_RECRUITER;
    serverClient(context);

    await expect(setApplicationStage({ applicationId: APPLICATION_ID, stage: "reviewed" })).resolves.toEqual({
      ok: true,
    });
    await settle();
    expect(h.createNotification).toHaveBeenCalledTimes(1);
    expect(h.email.sendApplicationStatusEmail).not.toHaveBeenCalled();
  });

  it("still emails the candidate from a real recruiter", async () => {
    h.profile = REAL_RECRUITER;
    serverClient(context);

    await expect(setApplicationStage({ applicationId: APPLICATION_ID, stage: "reviewed" })).resolves.toEqual({
      ok: true,
    });
    await vi.waitFor(() => expect(h.email.sendApplicationStatusEmail).toHaveBeenCalledTimes(1));
  });
});
