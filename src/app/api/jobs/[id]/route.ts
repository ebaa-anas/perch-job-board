import { NextResponse } from "next/server";

import { getJobById } from "@/features/jobs/data";

/** GET /api/jobs/[id] — a single job, or 404. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/jobs/[id]">,
) {
  const { id } = await context.params;
  const job = await getJobById(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}
