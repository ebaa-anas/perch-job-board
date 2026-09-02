import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  return NextResponse.json(
    { ok: !error, jobs: count ?? 0 },
    { status: error ? 500 : 200 },
  );
}
