import type { Metadata } from "next";

import { requireRole } from "@/features/auth/session";
import { getOwnSavedSearches, MAX_SAVED_SEARCHES } from "@/features/alerts/data";
import { AlertsList } from "@/features/alerts/components/alerts-list";

export const metadata: Metadata = {
  title: "Job alerts",
  robots: { index: false, follow: false },
};

export default async function AlertsPage() {
  await requireRole("seeker", "/alerts");
  const searches = await getOwnSavedSearches();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">Job alerts</h1>
      <p className="mt-1 text-muted-foreground">
        Saved searches we check for you. You can keep {MAX_SAVED_SEARCHES}.
      </p>

      <div className="mt-8">
        <AlertsList searches={searches} />
      </div>
    </div>
  );
}
