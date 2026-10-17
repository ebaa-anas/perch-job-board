import { NextResponse, type NextRequest } from "next/server";

import { runDueAlerts } from "@/features/alerts/runner";
import { cronAuthError } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
/** Digests for a whole board can outlast the default function timeout. */
export const maxDuration = 60;

/**
 * Cron entry point for job alerts (see `vercel.json`). Without the secret this
 * would let anyone make the product email every seeker on demand.
 */
export async function GET(request: NextRequest) {
  const refused = cronAuthError(request, "alerts");
  if (refused) return refused;

  const summary = await runDueAlerts();
  return NextResponse.json({ ok: summary.errors === 0, ...summary });
}
