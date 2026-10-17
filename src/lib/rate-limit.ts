import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  RATE_LIMITS,
  identityFromHeaders,
  type RateLimitBucket,
} from "@/lib/rate-limit-rules";

/**
 * Rate limiting for the public write paths.
 *
 * The v1 spec accepted "no rate limiting" as a known risk; with a public apply
 * path and public reviews that is now the cheapest way to damage the product.
 *
 * Counters live in Postgres (migration 0016), not in module scope: on Vercel
 * each request can land in a fresh function instance, so an in-process counter
 * limits nothing. The rules and the header parsing — the part that actually
 * goes wrong — live in `rate-limit-rules.ts` so they unit-test on their own.
 */

export type { RateLimitBucket };

/**
 * Consume one attempt from a bucket. `true` means "go ahead".
 *
 * Fails **open**: if the limiter itself is broken (migration not applied,
 * database unreachable) a real seeker should not be stopped from applying for
 * a job. Contrast `isAdminEmail`, which fails closed — there the downside of
 * guessing wrong is an unauthorised admin, here it is a lost application.
 * The failure is logged rather than swallowed.
 */
async function consumeRateLimit(
  bucket: RateLimitBucket,
  identity: string,
): Promise<boolean> {
  const rule = RATE_LIMITS[bucket];
  try {
    const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_identity: identity,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc failed, allowing request", error);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error("[rate-limit] unavailable, allowing request", error);
    return true;
  }
}

/**
 * Rate limit the current request by client address. Call from a Server Action.
 * Keyed by IP rather than by user id so it also covers the unauthenticated
 * paths (signup) and the "many throwaway accounts, one machine" case.
 */
export async function rateLimitRequest(
  bucket: RateLimitBucket,
): Promise<boolean> {
  return consumeRateLimit(bucket, identityFromHeaders(await headers()));
}

/** Rate limit by a stable subject (usually a profile id) instead of by IP. */
export async function rateLimitSubject(
  bucket: RateLimitBucket,
  subjectId: string,
): Promise<boolean> {
  return consumeRateLimit(bucket, `subject:${subjectId}`);
}
