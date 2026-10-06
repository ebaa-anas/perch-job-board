import { describe, expect, it } from "vitest";

import {
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schema";

describe("signInSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  const VALID = { email: "a@b.com", password: "password1", fullName: "Ada", role: "seeker" as const };

  it("accepts a valid signup", () => {
    expect(signUpSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    expect(signUpSchema.safeParse({ ...VALID, password: "short1" }).success).toBe(false);
  });

  it("rejects a name under 2 characters after trimming", () => {
    expect(signUpSchema.safeParse({ ...VALID, fullName: " a " }).success).toBe(false);
  });

  it("rejects a role outside seeker/recruiter", () => {
    expect(signUpSchema.safeParse({ ...VALID, role: "admin" }).success).toBe(false);
  });
});

describe("resetRequestSchema", () => {
  it("requires a valid email", () => {
    expect(resetRequestSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
    expect(resetRequestSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    expect(
      newPasswordSchema.safeParse({ password: "password1", confirm: "password1" }).success,
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = newPasswordSchema.safeParse({ password: "password1", confirm: "password2" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirm"]);
    }
  });

  it("rejects a password under 8 characters even if it matches confirm", () => {
    expect(newPasswordSchema.safeParse({ password: "short1", confirm: "short1" }).success).toBe(
      false,
    );
  });
});
