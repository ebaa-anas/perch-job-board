/**
 * Pure admin-email matching — no server-only imports, so it unit-tests without
 * a database, the same split as `redirect.ts`.
 */

/**
 * Case-insensitive membership test against the `admin_emails` rows.
 *
 * Compared in JS rather than with `ilike` because `_` and `%` are wildcards
 * there and both are legal in an email local part: an `admin_emails` row for
 * `a_b@x.com` would otherwise also match `axb@x.com` and hand that account the
 * admin console. This mirrors the SQL `is_admin()` helper, which lowercases
 * both sides for the same reason.
 */
export function isListedAdminEmail(
  rows: ReadonlyArray<{ email: string | null }>,
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  const needle = email.trim().toLowerCase();
  if (!needle) return false;
  return rows.some((row) => (row.email ?? "").trim().toLowerCase() === needle);
}
