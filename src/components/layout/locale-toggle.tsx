"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "en", label: "EN" },
  { value: "tr", label: "TR" },
] as const;

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Site language"
      className="inline-flex items-center rounded-md border border-input p-0.5 text-xs font-medium"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={locale === option.value}
          onClick={() => setLocale(option.value)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            locale === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
