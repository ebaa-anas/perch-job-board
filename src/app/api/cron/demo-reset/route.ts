import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthError } from "@/lib/cron-auth";
import { isDemoMode } from "@/features/demo/demo-rules";
import { clearDemoData, seedDemoData } from "@/features/demo/reset";

export const dynamic = "force-dynamic";
/** A reset is a few dozen API calls; this leaves room on any plan. */
export const maxDuration = 60;

/**
 * Daily demo reset (see `vercel.json`): clear every `@seed.perch.test`
 * account and rebuild the set, so whatever visitors did yesterday is gone —
 * the same thing `npm run demo:reset` does from a terminal.
 *
 * Only ever runs with demo mode on. On a deployment without it, real data may
 * sit next to stale seed rows, and nothing should be deleted on a schedule
 * there; the call reports a skip instead of failing, so the cron log stays
 * quiet.
 */
export async function GET(request: NextRequest) {
  const refused = cronAuthError(request, "demo-reset");
  if (refused) return refused;

  if (!isDemoMode()) {
    return NextResponse.json({ ok: true, skipped: "demo mode is off" });
  }

  try {
    const admin = createAdminClient();
    const cleared = await clearDemoData(admin, (line) => console.info(`[demo-reset] ${line}`));
    const seeded = await seedDemoData(admin, {
      passwords: {
        seeker: process.env.DEMO_SEEKER_PASSWORD,
        recruiter: process.env.DEMO_RECRUITER_PASSWORD,
      },
      log: (line) => console.info(`[demo-reset] ${line}`),
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, cleared, seeded });
  } catch (error) {
    console.error("[demo-reset] failed", error);
    return NextResponse.json({ ok: false, error: "reset failed" }, { status: 500 });
  }
}
