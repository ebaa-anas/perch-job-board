/**
 * Locale constants shared by both server-only code (`locale.ts`, which reads
 * the cookie) and client code (`locale-provider.tsx`, which writes it). Kept
 * free of `server-only`/`next/headers` so importing it never pulls either
 * into a client bundle.
 */
export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "perch-locale";
