import { NextResponse } from "next/server";
import { getJobBySlug } from "@/features/jobs/data";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/jobs/[slug]">,
) {
  const { slug } = await context.params;
  const job = await getJobBySlug(slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job });
}
