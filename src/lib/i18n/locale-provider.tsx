"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale-types";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

/**
 * Seeded from the server-resolved locale (see `getLocale()`), so the first
 * client render always matches what was already sent down — no flash of the
 * wrong language the way a localStorage-only resolution would cause, since
 * locale changes actual text content rather than just a CSS class.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = React.useState(initialLocale);

  const setLocale = React.useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
