import { NextResponse, type NextRequest } from "next/server";
import { getJobs } from "@/features/jobs/data";
import { filterAndSortJobs, parseJobFilters } from "@/features/jobs/utils";

export async function GET(request: NextRequest) {
  const jobs = await getJobs();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseJobFilters(params);
  const result = filterAndSortJobs(jobs, filters);
  return NextResponse.json({ jobs: result, total: result.length, filters });
}
// POST removed in Phase 1 — returns in Phase 3 as a server action / owner route.
