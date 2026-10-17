import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_ROLES,
  crossesDemoBoundary,
  isDemoMode,
  isDemoRole,
  isDemoUser,
} from "@/features/demo/demo-rules";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDemoUser", () => {
  it("accepts any address on the seed domain", () => {
    expect(isDemoUser("demo-seeker@seed.perch.test")).toBe(true);
    expect(isDemoUser("nadia@seed.perch.test")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(isDemoUser("  Demo-Recruiter@SEED.Perch.Test ")).toBe(true);
  });

  it("rejects lookalike domains", () => {
    expect(isDemoUser("x@notseed.perch.test")).toBe(false);
    expect(isDemoUser("x@seed.perch.test.example.com")).toBe(false);
    expect(isDemoUser("x@sub.seed.perch.test")).toBe(false);
    expect(isDemoUser("seed.perch.test@gmail.com")).toBe(false);
    expect(isDemoUser("x@perch.test")).toBe(false);
  });

  it("treats a missing address as a real account, never a demo one", () => {
    expect(isDemoUser(null)).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
    expect(isDemoUser("")).toBe(false);
  });
});

describe("DEMO_ACCOUNTS", () => {
  it("covers the two visitor roles and nothing else — never an admin", () => {
    expect(Object.keys(DEMO_ACCOUNTS).sort()).toEqual(["recruiter", "seeker"]);
    expect(DEMO_ROLES).not.toContain("admin");
  });

  it("puts both logins on the demo domain", () => {
    for (const account of Object.values(DEMO_ACCOUNTS)) {
      expect(account.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
      expect(isDemoUser(account.email)).toBe(true);
    }
  });
});

describe("isDemoMode", () => {
  it("is off unless the flag is exactly true", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "yes");
    expect(isDemoMode()).toBe(false);
  });

  it("is on for true, in any case", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoMode()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", " TRUE ");
    expect(isDemoMode()).toBe(true);
  });
});

describe("isDemoRole", () => {
  it("accepts only the two visitor roles", () => {
    expect(isDemoRole("seeker")).toBe(true);
    expect(isDemoRole("recruiter")).toBe(true);
    expect(isDemoRole("admin")).toBe(false);
    expect(isDemoRole("")).toBe(false);
    expect(isDemoRole(undefined)).toBe(false);
    expect(isDemoRole({ role: "seeker" })).toBe(false);
  });
});

describe("crossesDemoBoundary", () => {
  const demo = "demo-seeker@seed.perch.test";
  const otherDemo = "nadia@seed.perch.test";
  const real = "someone@example.com";

  it("allows demo-to-demo and real-to-real", () => {
    expect(crossesDemoBoundary(demo, otherDemo)).toBe(false);
    expect(crossesDemoBoundary(real, "other@example.com")).toBe(false);
  });

  it("refuses demo-to-real in either direction", () => {
    expect(crossesDemoBoundary(demo, real)).toBe(true);
    expect(crossesDemoBoundary(real, demo)).toBe(true);
  });

  it("treats an unknown side (no owner, no email) as real", () => {
    expect(crossesDemoBoundary(demo, null)).toBe(true);
    expect(crossesDemoBoundary(real, null)).toBe(false);
  });
});
