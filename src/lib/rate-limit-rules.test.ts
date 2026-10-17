import { describe, expect, it } from "vitest";

import { RATE_LIMITS, identityFromHeaders } from "@/lib/rate-limit-rules";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("identityFromHeaders", () => {
  it("uses the client IP, not the proxy chain", () => {
    // x-forwarded-for is "client, proxy1, proxy2" — only the first is the client.
    const id = identityFromHeaders(
      headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" }),
    );
    expect(id).toBe("203.0.113.5");
  });

  it("trims surrounding whitespace", () => {
    expect(identityFromHeaders(headers({ "x-forwarded-for": "  203.0.113.5 " }))).toBe(
      "203.0.113.5",
    );
  });

  it("falls back to x-real-ip", () => {
    expect(identityFromHeaders(headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const id = identityFromHeaders(
      headers({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "203.0.113.9" }),
    );
    expect(id).toBe("203.0.113.5");
  });

  it("returns a constant when no address is present, so limits still apply", () => {
    expect(identityFromHeaders(headers({}))).toBe("unknown");
  });

  it("ignores an empty or whitespace-only header", () => {
    expect(identityFromHeaders(headers({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(identityFromHeaders(headers({ "x-forwarded-for": "   " }))).toBe("unknown");
    expect(identityFromHeaders(headers({ "x-forwarded-for": ", 10.0.0.1" }))).toBe("unknown");
  });
});

describe("RATE_LIMITS", () => {
  it("defines a positive ceiling and window for every bucket", () => {
    for (const [bucket, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.max, bucket).toBeGreaterThan(0);
      expect(rule.windowSeconds, bucket).toBeGreaterThan(0);
    }
  });

  it("covers the public write paths that have no other gate", () => {
    expect(RATE_LIMITS).toHaveProperty("apply");
    expect(RATE_LIMITS).toHaveProperty("signup");
    expect(RATE_LIMITS).toHaveProperty("review");
  });
});
