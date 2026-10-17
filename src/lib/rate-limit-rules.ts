/**
 * Pure rate-limit rules and client-identity parsing — no server-only imports,
 * so it unit-tests without a database, the same split as `admin-emails-match.ts`.
 */

export interface RateLimitRule {
  /** Attempts allowed inside the window. */
  max: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  /**
   * Applying is cheap for a bot and expensive for a recruiter's inbox. Keyed
   * per account, not per address: a university lab or an office all share one
   * NAT address, and this product's audience is disproportionately on exactly
   * those networks. An IP key would throttle a whole campus collectively.
   */
  apply: { max: 20, windowSeconds: 60 * 60 },
  /**
   * Signup floods are how fake-employer and CV-harvesting accounts arrive.
   * This one has to stay address-keyed — there is no account to key on yet —
   * so the ceiling is set high enough that a shared office or campus network
   * signing up together is not mistaken for an attack.
   */
  signup: { max: 20, windowSeconds: 60 * 60 },
  /** Review brigading, in either direction, is the main threat to the ratings. */
  review: { max: 10, windowSeconds: 60 * 60 },
  /**
   * One-click demo sign-in. Address-keyed because the visitor has no account
   * of their own. A person exploring both roles needs a handful; the ceiling
   * is there because every sign-in mints a session on a shared account, and a
   * script looping on it would exhaust Supabase's own auth limit for everyone.
   */
  demo: { max: 20, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const FALLBACK_IDENTITY = "unknown";

/**
 * The caller's address, as seen through the platform proxy.
 *
 * `x-forwarded-for` is a chain — `client, proxy1, proxy2` — and only the first
 * entry is the client; keying on the whole string would give every request its
 * own bucket and so limit nothing. A missing address collapses to one shared
 * bucket rather than to "unlimited".
 */
export function identityFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return FALLBACK_IDENTITY;
}
