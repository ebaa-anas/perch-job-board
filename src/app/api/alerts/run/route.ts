import { NextResponse, type NextRequest } from "next/server";

import { runDueAlerts } from "@/features/alerts/runner";

export const dynamic = "force-dynamic";
/** Digests for a whole board can outlast the default function timeout. */
export const maxDuration = 60;

/**
 * Cron entry point for job alerts (see `vercel.json`).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is
 * set on the project. The endpoint is public routing-wise, so the secret is
 * the only thing standing between an unauthenticated caller and the ability to
 * make the product email every seeker on demand — missing secret in
 * production therefore refuses rather than running.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[alerts] CRON_SECRET is not set — refusing to run");
      return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
    }
    // Local development: no secret configured, run it so it can be exercised.
  } else if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await runDueAlerts();
  return NextResponse.json({ ok: summary.errors === 0, ...summary });
}
