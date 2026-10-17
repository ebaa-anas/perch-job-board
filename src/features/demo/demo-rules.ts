/**
 * Demo mode, as pure rules.
 *
 * No server-only imports: the seed scripts, the reset cron, the server actions
 * and the unit tests all read from here, so "who counts as a demo account" is
 * decided in exactly one place.
 */

/**
 * Every seeded account lives on this domain, the two shared demo logins
 * included. `.test` is reserved (RFC 2606), so no address on it can belong to
 * a real person or receive mail.
 */
export const DEMO_EMAIL_DOMAIN = "seed.perch.test";

export const DEMO_ROLES = ["seeker", "recruiter"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/**
 * The two logins a visitor can borrow. There is deliberately no admin: the
 * console is shown through screenshots only, and `admin_emails` refuses this
 * domain outright (migration 0023).
 */
export const DEMO_ACCOUNTS: Record<DemoRole, { email: string; fullName: string }> = {
  seeker: { email: `demo-seeker@${DEMO_EMAIL_DOMAIN}`, fullName: "Deniz Aksoy" },
  recruiter: { email: `demo-recruiter@${DEMO_EMAIL_DOMAIN}`, fullName: "Selin Arslan" },
};

/** Set when a visitor closes the demo banner; read by the root layout. */
export const DEMO_BANNER_COOKIE = "perch-demo-banner";

/**
 * Whether `email` belongs to a demo or seeded account.
 *
 * The test is on the whole `@domain` suffix rather than a substring, so
 * `x@seed.perch.test.example.com` and `x@notseed.perch.test` are not demo
 * accounts and cannot pick up the restrictions — or the reset — meant for one.
 */
export function isDemoUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/**
 * The deployment-wide switch. Read through the literal
 * `process.env.NEXT_PUBLIC_DEMO_MODE` so Next.js can inline it at build time;
 * a destructured or computed lookup would not be.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE?.trim().toLowerCase() === "true";
}

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && (DEMO_ROLES as readonly string[]).includes(value);
}

/**
 * Whether an interaction between two accounts would cross from demo data into
 * real data — exactly one side being a demo account.
 *
 * The demo logins are shared by everyone on the internet, so anything a demo
 * recruiter can see is effectively public. A real seeker's application to a
 * demo job, or a demo visitor's review of a real company, must not happen.
 */
export function crossesDemoBoundary(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return isDemoUser(a) !== isDemoUser(b);
}
