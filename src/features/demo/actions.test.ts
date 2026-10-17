import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-click demo sign-in, with Supabase and the Next.js request plumbing
 * stubbed out: what is under test is the action's own decisions — when it
 * refuses, what it signs in with, and how it repairs a changed password.
 */

const h = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    RedirectError,
    locale: "en",
    signInWithPassword: vi.fn(),
    listUsers: vi.fn(),
    updateUserById: vi.fn(),
    rateLimitRequest: vi.fn(),
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
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "perch-locale" ? { name, value: h.locale } : undefined),
    getAll: () => [],
    set: () => {},
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: h.signInWithPassword } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: h.listUsers, updateUserById: h.updateUserById } },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitRequest: h.rateLimitRequest }));

import { demoSignInAction, signInAsDemo } from "@/features/demo/actions";
import { DEMO_ACCOUNTS } from "@/features/demo/demo-rules";
import { en } from "@/lib/i18n/dictionaries/en";
import { tr } from "@/lib/i18n/dictionaries/tr";

const SEEKER_PASSWORD = "seeker-password-from-env";
const RECRUITER_PASSWORD = "recruiter-password-from-env";
const WRONG_CREDENTIALS = { error: { message: "Invalid login credentials" } };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
  vi.stubEnv("DEMO_SEEKER_PASSWORD", SEEKER_PASSWORD);
  vi.stubEnv("DEMO_RECRUITER_PASSWORD", RECRUITER_PASSWORD);
  h.locale = "en";
  h.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  h.rateLimitRequest.mockReset().mockResolvedValue(true);
  h.listUsers.mockReset().mockResolvedValue({
    data: {
      users: [
        { id: "u-real", email: "someone@example.com" },
        { id: "u-demo-seeker", email: DEMO_ACCOUNTS.seeker.email },
        { id: "u-demo-recruiter", email: DEMO_ACCOUNTS.recruiter.email },
      ],
    },
    error: null,
  });
  h.updateUserById.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signInAsDemo — demo mode off", () => {
  it("returns an error and never reaches auth or the rate limiter", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");

    await expect(signInAsDemo("seeker")).resolves.toEqual({ error: en.demo.errors.off });
    expect(h.signInWithPassword).not.toHaveBeenCalled();
    expect(h.rateLimitRequest).not.toHaveBeenCalled();
  });

  it("treats a missing flag as off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");

    await expect(signInAsDemo("recruiter")).resolves.toEqual({ error: en.demo.errors.off });
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });

  it("answers in the visitor's language", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    h.locale = "tr";

    await expect(signInAsDemo("seeker")).resolves.toEqual({ error: tr.demo.errors.off });
  });
});

describe("signInAsDemo — refusals", () => {
  it("accepts only the two visitor roles: there is no demo admin", async () => {
    for (const role of ["admin", "", null, undefined, 42, { role: "seeker" }]) {
      await expect(signInAsDemo(role)).resolves.toEqual({ error: en.demo.errors.off });
    }
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });

  it("says the demo is not set up when its password is not configured", async () => {
    vi.stubEnv("DEMO_SEEKER_PASSWORD", "   ");

    await expect(signInAsDemo("seeker")).resolves.toEqual({
      error: en.demo.errors.notConfigured,
    });
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });

  it("is rate limited per connection", async () => {
    h.rateLimitRequest.mockResolvedValue(false);

    await expect(signInAsDemo("seeker")).resolves.toEqual({ error: en.demo.errors.rateLimited });
    expect(h.rateLimitRequest).toHaveBeenCalledWith("demo");
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signInAsDemo — signing in", () => {
  it("uses the server-side password for the chosen role and lands on the dashboard", async () => {
    await expect(signInAsDemo("recruiter")).rejects.toMatchObject({ url: "/dashboard" });
    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: DEMO_ACCOUNTS.recruiter.email,
      password: RECRUITER_PASSWORD,
    });
  });

  it("puts back a password a visitor changed, then signs in", async () => {
    h.signInWithPassword.mockResolvedValueOnce(WRONG_CREDENTIALS).mockResolvedValueOnce({ error: null });

    await expect(signInAsDemo("seeker")).rejects.toMatchObject({ url: "/dashboard" });
    expect(h.updateUserById).toHaveBeenCalledTimes(1);
    expect(h.updateUserById).toHaveBeenCalledWith("u-demo-seeker", { password: SEEKER_PASSWORD });
    expect(h.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it("reports the demo as unavailable while the account is missing mid-reset", async () => {
    h.signInWithPassword.mockResolvedValue(WRONG_CREDENTIALS);
    h.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

    await expect(signInAsDemo("seeker")).resolves.toEqual({ error: en.demo.errors.unavailable });
    expect(h.updateUserById).not.toHaveBeenCalled();
  });

  it("does not attempt a repair for failures other than wrong credentials", async () => {
    h.signInWithPassword.mockResolvedValue({ error: { message: "Request rate limit reached" } });

    await expect(signInAsDemo("recruiter")).resolves.toEqual({ error: en.demo.errors.unavailable });
    expect(h.listUsers).not.toHaveBeenCalled();
    expect(h.updateUserById).not.toHaveBeenCalled();
  });

  it("never hands the password back to the browser", async () => {
    h.signInWithPassword.mockResolvedValue(WRONG_CREDENTIALS);
    h.updateUserById.mockResolvedValue({ error: { message: "boom" } });

    const result = await signInAsDemo("seeker");
    expect(JSON.stringify(result)).not.toContain(SEEKER_PASSWORD);
  });
});

describe("demoSignInAction", () => {
  it("takes the role from the pressed button", async () => {
    const form = new FormData();
    form.set("role", "seeker");

    await expect(demoSignInAction(null, form)).rejects.toMatchObject({ url: "/dashboard" });
    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: DEMO_ACCOUNTS.seeker.email,
      password: SEEKER_PASSWORD,
    });
  });

  it("refuses a form without a role", async () => {
    await expect(demoSignInAction(null, new FormData())).resolves.toEqual({
      error: en.demo.errors.off,
    });
  });
});
