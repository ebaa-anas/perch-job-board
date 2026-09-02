const STORAGE_KEY = "perch-saved-jobs";

export const SAVED_JOBS_STORAGE_KEY = STORAGE_KEY;

/** Read the saved job ids from localStorage. Returns `[]` on the server or on error. */
export function readSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

/** Persist saved job ids, ignoring quota / serialization errors. */
export function writeSavedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
