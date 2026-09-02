const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Public URL for an object in the (public) `logos` bucket. `path` is the stored
 * `companies.logo_path` (e.g. `<uid>/<uuid>.png`). Returns null when unset.
 */
export function logoPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/logos/${path}`;
}
