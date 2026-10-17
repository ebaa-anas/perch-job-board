/**
 * Pure helpers for CV object paths — no server-only imports, so they unit-test
 * without a database.
 *
 * A CV lives at `<profile id>/<file>` in the private `cvs` bucket, and the
 * storage policies in 0002 enforce that first segment with
 * `(storage.foldername(name))[1] = auth.uid()::text`. These helpers keep the
 * action layer agreeing with the policy instead of guessing at it.
 */

/**
 * Whether `path` is a CV belonging to `profileId`.
 *
 * Deliberately stricter than a `startsWith` check. `startsWith` alone accepts
 * `<id>/../<someone else>/cv.pdf`, which normalises to another seeker's folder
 * — the SQL policy reads segment one and would reject it, so the action should
 * reject it too rather than hand Storage something the policy will bounce.
 */
export function isOwnCvPath(
  path: string | null | undefined,
  profileId: string,
): boolean {
  if (!path || !profileId) return false;
  // Backslashes are not separators in a storage key, but treating them as
  // ordinary characters is how `a\..\b` style tricks sneak past a split on "/".
  if (path.includes("\\")) return false;

  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments[0] !== profileId) return false;
  // No empty, "." or ".." segments anywhere, and a real filename at the end.
  return segments.every((s) => s !== "" && s !== "." && s !== "..");
}
