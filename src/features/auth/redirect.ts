/**
 * Pure redirect-target validation — no server-only imports, so it is safe to
 * unit-test and to share with Client Components.
 *
 * An attacker controls `?next=` on the login URL. After a successful sign-in the
 * server `redirect()`s there, so anything but a path on *this* origin is an
 * open-redirect (phishing) hole. Only accept a value that is unambiguously a
 * local path: exactly one leading slash, the next character is neither `/` nor
 * `\` (both resolve to a protocol-relative URL → another origin), and no control
 * characters (tab / newline smuggling past the leading-slash check).
 */
export function safeRelativePath(
  next: string | null | undefined,
): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!/^\/(?![/\\])/.test(next)) return null;
  for (let i = 0; i < next.length; i += 1) {
    if (next.charCodeAt(i) < 0x20 || next.charCodeAt(i) === 0x7f) return null;
  }
  return next;
}
