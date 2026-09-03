import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  actingAs,
  actingAsGuest,
  cleanupAdminEmail,
  cleanupUsers,
  expectRedirect,
  makeUser,
  service,
  uniq,
} from "@/test/e2e-helpers";
import {
  completeOnboarding,
  maybeUpgradeAdmin,
  signIn,
  signOut,
  signUp,
} from "@/features/auth/actions";
import { getProfile, requireRole, requireUser } from "@/features/auth/session";

const seekerEmail = uniq("e2e-auth-seeker") + "@perch.test";
const nullRoleEmail = uniq("e2e-auth-null") + "@perch.test";
const adminEmail = uniq("e2e-auth-admin") + "@perch.test";
const signupEmail = uniq("e2e-auth-signup") + "@perch.test";

beforeAll(async () => {
  await makeUser(seekerEmail, "seeker", "Auth Seeker");
  await makeUser(nullRoleEmail, null, "No Role");
  await makeUser(adminEmail, null, "Soon Admin");
  await service()
    .from("admin_emails")
    .upsert({ email: adminEmail.toLowerCase() }, { onConflict: "email" });
});

afterAll(async () => {
  const svc = service();
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
  const stray = (data?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === signupEmail.toLowerCase(),
  );
  if (stray) await svc.auth.admin.deleteUser(stray.id);
  await cleanupAdminEmail(adminEmail);
  await cleanupUsers();
});

describe("signUp", () => {
  it("rejects a non-signup role", async () => {
    const r = await signUp({
      email: signupEmail,
      password: "abcd1234",
      fullName: "X",
      // @ts-expect-error — a crafted call
      role: "admin",
    });
    expect(r).toEqual({ error: expect.stringContaining("looking for work") });
  });

  it("maps provider errors to a friendly string (invalid email domain)", async () => {
    // GoTrue rejects `.test` addresses on public signup; the action should
    // surface a friendly message, never crash. (A deliverable-email happy path
    // needs a real inbox + SMTP and isn't exercised here.)
    const r = await signUp({
      email: signupEmail,
      password: "abcd1234",
      fullName: "Sign Up",
      role: "seeker",
    });
    expect(r).toHaveProperty("error");
    // GoTrue rejects `.test` domains on public signup; either the invalid-email
    // mapping or the rate-limit mapping is acceptable — the point is it's a
    // friendly string, not a crash.
    expect((r as { error: string }).error).toMatch(
      /email address looks invalid|Too many attempts/,
    );
  });
});

describe("signIn", () => {
  it("maps a bad password to a friendly error", async () => {
    const r = await signIn({ email: seekerEmail, password: "wrong-password" });
    expect(r).toEqual({ error: "Wrong email or password." });
  });

  it("redirects a seeker to /dashboard", async () => {
    const to = await expectRedirect(
      signIn({ email: seekerEmail, password: "perch-e2e-pw-abc123" }),
    );
    expect(to).toBe("/dashboard");
  });

  it("honours a safe ?next path", async () => {
    const to = await expectRedirect(
      signIn({
        email: seekerEmail,
        password: "perch-e2e-pw-abc123",
        next: "/jobs/some-role?apply=1",
      }),
    );
    expect(to).toBe("/jobs/some-role?apply=1");
  });

  it("ignores an open-redirect ?next", async () => {
    const to = await expectRedirect(
      signIn({
        email: seekerEmail,
        password: "perch-e2e-pw-abc123",
        next: "//evil.example.com",
      }),
    );
    expect(to).toBe("/dashboard");
  });
});

describe("onboarding", () => {
  it("sets the role once and is not re-flippable", async () => {
    await actingAs(nullRoleEmail);
    const to = await expectRedirect(completeOnboarding("seeker"));
    expect(to).toBe("/dashboard");

    const { data: after } = await service()
      .from("profiles")
      .select("role")
      .eq("id", (await getProfile())!.id)
      .single();
    expect(after?.role).toBe("seeker");

    // Second attempt: guarded by `.is("role", null)` — no error, role unchanged.
    await expectRedirect(completeOnboarding("recruiter"));
    const { data: again } = await service()
      .from("profiles")
      .select("role")
      .eq("id", (await getProfile())!.id)
      .single();
    expect(again?.role).toBe("seeker");
  });

  it("rejects onboarding as admin", async () => {
    await actingAs(seekerEmail);
    const r = await completeOnboarding(
      // @ts-expect-error — crafted
      "admin",
    );
    expect(r).toEqual({ error: expect.any(String) });
  });
});

describe("route guards", () => {
  it("requireUser bounces a guest to /login with next", async () => {
    actingAsGuest();
    const to = await expectRedirect(requireUser("/profile"));
    expect(to).toBe("/login?next=%2Fprofile");
  });

  it("requireRole('recruiter') bounces a seeker to /", async () => {
    await actingAs(seekerEmail);
    const to = await expectRedirect(requireRole("recruiter"));
    expect(to).toBe("/");
  });

  it("requireRole('seeker') passes for a seeker", async () => {
    await actingAs(seekerEmail);
    const profile = await requireRole("seeker");
    expect(profile.role).toBe("seeker");
  });
});

describe("admin upgrade + signOut", () => {
  it("maybeUpgradeAdmin promotes an allow-listed email", async () => {
    await actingAs(adminEmail);
    await maybeUpgradeAdmin();
    const { data } = await service()
      .from("profiles")
      .select("role")
      .eq("id", (await getProfile())!.id)
      .single();
    expect(data?.role).toBe("admin");
  });

  it("signOut redirects home", async () => {
    await actingAs(seekerEmail);
    const to = await expectRedirect(signOut());
    expect(to).toBe("/");
  });
});
