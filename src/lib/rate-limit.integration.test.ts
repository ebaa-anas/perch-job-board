import { afterAll, describe, expect, it } from "vitest";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * `consume_rate_limit` (migration 0016).
 *
 * The limiter's pure half — the rules table and `identityFromHeaders` — is
 * unit-tested. This covers the half that actually enforces anything: the SQL
 * function, its window arithmetic, and the fact that it is unreachable except
 * over the service role.
 */

const bucket = `test-${Date.now()}`;

async function consume(identity: string, max: number, windowSeconds = 3600) {
  const { data, error } = await serviceClient().rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_identity: identity,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message);
  return data;
}

afterAll(async () => {
  await serviceClient().from("rate_limit_hits").delete().eq("bucket", bucket);
});

describe("consume_rate_limit", () => {
  it("allows attempts up to the ceiling and refuses the next one", async () => {
    const identity = "ceiling";
    expect(await consume(identity, 3)).toBe(true);
    expect(await consume(identity, 3)).toBe(true);
    expect(await consume(identity, 3)).toBe(true);
    expect(await consume(identity, 3)).toBe(false);
  });

  it("does not record the refused attempt, so a blocked caller cannot extend its own lockout", async () => {
    const identity = "no-self-extend";
    await consume(identity, 1);
    await consume(identity, 1);
    await consume(identity, 1);

    const { count } = await serviceClient()
      .from("rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("identity", identity);
    expect(count).toBe(1);
  });

  it("keeps identities independent", async () => {
    expect(await consume("alice", 1)).toBe(true);
    expect(await consume("alice", 1)).toBe(false);
    // Bob is unaffected by Alice exhausting hers — the property that makes
    // per-account keying safe on a shared network.
    expect(await consume("bob", 1)).toBe(true);
  });

  it("forgets attempts that have left the window", async () => {
    const identity = "expiry";
    // A zero-second window means every prior attempt is already outside it.
    expect(await consume(identity, 1, 0)).toBe(true);
    expect(await consume(identity, 1, 0)).toBe(true);
  });

  it("is unreachable from an anonymous caller", async () => {
    const { error } = await anonClient().rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_identity: "anon",
      p_max: 1,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
  });

  it("keeps its counters unreadable from an anonymous caller", async () => {
    const { data } = await anonClient().from("rate_limit_hits").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
