import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createJob, getJobs } from "@/features/jobs/data";
import { jobCreateApiSchema } from "@/features/jobs/schema";
import { filterAndSortJobs, parseJobFilters } from "@/features/jobs/utils";

/** GET /api/jobs — list jobs, honouring the same query params as the UI. */
export async function GET(request: NextRequest) {
  const jobs = await getJobs();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseJobFilters(params);
  const result = filterAndSortJobs(jobs, filters);

  return NextResponse.json({ jobs: result, total: result.length, filters });
}

/** POST /api/jobs — create a job from a validated JSON body. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, {
      status: 400,
    });
  }

  const parsed = jobCreateApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 422 },
    );
  }

  const job = await createJob(parsed.data);
  return NextResponse.json({ job }, { status: 201 });
}
