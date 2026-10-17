import "server-only";

import { NextResponse } from "next/server";

/**
 * Gate for the Vercel Cron routes (see `vercel.json`).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is
 * set on the project. The routes are public routing-wise, so the secret is the
 * only thing between an unauthenticated caller and running the job on demand
 * — a missing secret in production therefore refuses rather than runs.
 *
 * Returns the response to send when the request is refused, or null to go on.
 */
export function cronAuthError(request: Request, job: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[${job}] CRON_SECRET is not set — refusing to run`);
      return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
    }
    // Local development: no secret configured, run it so it can be exercised.
    return null;
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}
