import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serviceClient } from "@/test/setup-integration";

// data.ts reads cookies() via the server client, which isn't available in a
// plain test process. So exercise the same query shape with the service client
// and assert the row -> Job mapping contract that data.ts depends on.
const SELECT = "slug, status, companies!inner ( name, slug, logo_color )";

// The service client is created without the generated `Database` type, so
// PostgREST select strings aren't parsed into a precise result type. Assert the
// row -> Job mapping contract against this explicit shape instead.
type JoinedJobRow = {
  slug: string;
  status: string;
  companies: { name: string; slug: string; logo_color: string };
};

describe("jobs read contract", () => {
  let companyId: string | undefined;
  const stamp = Date.now();
  const jobSlug = `contract-job-${stamp}`;

  beforeAll(async () => {
    const svc = serviceClient();
    const { data: c, error: cErr } = await svc
      .from("companies")
      .insert({ name: "Contract Co", slug: `contract-co-${stamp}` })
      .select()
      .single();
    if (cErr) throw new Error(`seed company failed: ${cErr.message}`);
    companyId = c!.id;

    const { error: jErr } = await svc.from("jobs").insert({
      slug: jobSlug,
      company_id: companyId,
      title: "Read Contract",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 10,
      salary_max: 20,
      description: "x".repeat(60),
      tags: ["t"],
      responsibilities: ["r"],
      requirements: ["r"],
      status: "published",
    });
    if (jErr) throw new Error(`seed job failed: ${jErr.message}`);
  });

  afterAll(async () => {
    // Deleting the company cascades to its jobs (jobs.company_id ON DELETE
    // CASCADE). Runs even if an assertion above threw, so no rows leak.
    if (!companyId) return;
    await serviceClient().from("companies").delete().eq("id", companyId);
  });

  it("a published job joins its company", async () => {
    const { data, error } = await serviceClient()
      .from("jobs")
      .select(SELECT)
      .eq("slug", jobSlug)
      .single();
    expect(error).toBeNull();
    const row = data as unknown as JoinedJobRow;
    expect(row.companies.name).toBe("Contract Co");
    expect(row.status).toBe("published");
  });

  it("draft jobs are excluded by the published filter", async () => {
    const svc = serviceClient();
    await svc.from("jobs").update({ status: "draft" }).eq("slug", jobSlug);
    const { data } = await svc
      .from("jobs")
      .select("slug")
      .eq("slug", jobSlug)
      .eq("status", "published");
    expect(data).toHaveLength(0);
  });
});
