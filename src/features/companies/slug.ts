/**
 * Given a slug `root` and the set of slugs already taken (by *other* companies),
 * return `root` if free, else `root-2`, `root-3`, … Pure — unit-tested.
 */
export function pickFreeSlug(root: string, taken: Set<string>): string {
  const base = root || "company";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
