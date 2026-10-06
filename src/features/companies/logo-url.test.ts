import { describe, expect, it } from "vitest";

import { logoPublicUrl } from "@/features/companies/logo-url";

describe("logoPublicUrl", () => {
  it("returns null for a null or undefined path", () => {
    expect(logoPublicUrl(null)).toBeNull();
    expect(logoPublicUrl(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(logoPublicUrl("")).toBeNull();
  });

  it("builds the public storage URL for a given path", () => {
    const url = logoPublicUrl("abc123/logo.png");
    expect(url).toContain("/storage/v1/object/public/logos/abc123/logo.png");
  });
});
