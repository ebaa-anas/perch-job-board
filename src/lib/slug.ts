/** Lowercase, ASCII-ish, hyphen-separated slug. Shared by seed + forms. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Given a slug `root` and the set of slugs already taken (by *other* rows),
 * return `root` if free, else `root-2`, `root-3`, … Pure — unit-tested.
 */
export function pickFreeSlug(root: string, taken: Set<string>): string {
  const base = root || "item";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
