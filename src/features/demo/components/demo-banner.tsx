"use client";

import * as React from "react";
import { FlaskConical, X } from "lucide-react";

import { DEMO_BANNER_COOKIE } from "@/features/demo/demo-rules";
import { useLocale } from "@/lib/i18n/locale-provider";

/**
 * Strip above the header while signed in to a demo account. The root layout
 * decides whether to render it; closing it sets a day-long cookie the layout
 * reads, so it stays closed across navigations without a client-side check.
 */
export function DemoBanner() {
  const { t } = useLocale();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  const dismiss = () => {
    document.cookie = `${DEMO_BANNER_COOKIE}=dismissed; path=/; max-age=86400; samesite=lax`;
    setDismissed(true);
  };

  return (
    <div role="status" className="border-b border-primary/20 bg-accent text-accent-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">{t.demo.banner}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.demo.bannerDismiss}
          className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
