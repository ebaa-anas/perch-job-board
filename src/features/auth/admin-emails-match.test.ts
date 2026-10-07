import { describe, expect, it } from "vitest";

import { isListedAdminEmail } from "@/features/auth/admin-emails-match";

const rows = [{ email: "Owner@Perch.test" }, { email: "ops@perch.test" }];

describe("isListedAdminEmail", () => {
  it("matches regardless of case on either side", () => {
    expect(isListedAdminEmail(rows, "owner@perch.test")).toBe(true);
    expect(isListedAdminEmail(rows, "OWNER@PERCH.TEST")).toBe(true);
    expect(isListedAdminEmail(rows, "OPS@perch.test")).toBe(true);
  });

  it("ignores surrounding whitespace on either side", () => {
    expect(isListedAdminEmail(rows, "  owner@perch.test ")).toBe(true);
    expect(isListedAdminEmail([{ email: " ops@perch.test " }], "ops@perch.test")).toBe(true);
  });

  it("rejects an address that is not listed", () => {
    expect(isListedAdminEmail(rows, "someone@perch.test")).toBe(false);
  });

  it("does not treat `_` in a listed address as a wildcard", () => {
    // The whole reason this is a JS comparison and not `ilike`: under ILIKE,
    // `a_b@x.test` matches `axb@x.test`, which would hand an unrelated account
    // the admin console.
    const underscore = [{ email: "a_b@x.test" }];
    expect(isListedAdminEmail(underscore, "a_b@x.test")).toBe(true);
    expect(isListedAdminEmail(underscore, "axb@x.test")).toBe(false);
  });

  it("does not treat `%` in a listed address as a wildcard", () => {
    const percent = [{ email: "%@x.test" }];
    expect(isListedAdminEmail(percent, "anyone@x.test")).toBe(false);
    expect(isListedAdminEmail(percent, "%@x.test")).toBe(true);
  });

  it("rejects empty, null and undefined lookups", () => {
    expect(isListedAdminEmail(rows, "")).toBe(false);
    expect(isListedAdminEmail(rows, "   ")).toBe(false);
    expect(isListedAdminEmail(rows, null)).toBe(false);
    expect(isListedAdminEmail(rows, undefined)).toBe(false);
  });

  it("rejects everything against an empty list", () => {
    expect(isListedAdminEmail([], "owner@perch.test")).toBe(false);
  });

  it("tolerates a null email column without matching it", () => {
    expect(isListedAdminEmail([{ email: null }], "owner@perch.test")).toBe(false);
  });
});
