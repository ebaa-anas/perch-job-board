import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale-types";

export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale-types";

function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "tr";
}

/**
 * The signed-in-or-not visitor's UI locale for this request, read from a
 * cookie set by `LocaleToggle`. Resolved server-side (not client-only, unlike
 * theme) because the locale changes actual rendered text, not just a CSS
 * class — a client-only resolution would flash the default language first.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});
