"use client";

import * as React from "react";

import { recordJobView } from "@/features/analytics/actions";

const STORAGE_PREFIX = "perch:viewed:";

/**
 * Records one view of a job, once per browser session.
 *
 * A client effect rather than a write during server render, for three reasons:
 * render stays free of side effects, a crawler without JavaScript is not
 * counted, and the per-session guard below keeps a refresh or a back-navigation
 * from inflating the number the recruiter is judged on.
 *
 * `sessionStorage` can throw in a private window or with site data blocked, so
 * every access is guarded; when it is unavailable the view is simply counted
 * again rather than lost.
 */
export function TrackJobView({ jobId }: { jobId: string }) {
  React.useEffect(() => {
    const key = `${STORAGE_PREFIX}${jobId}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // No session storage — fall through and count the view.
    }

    void recordJobView(jobId);
  }, [jobId]);

  return null;
}
