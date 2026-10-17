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

// Depends on `npm run seed` (Task 7, Ruling 11) having populated the hosted DB:
// one `companies` row per distinct SEED_JOBS company (14) + 14 published jobs.
describe("seed data present", () => {
  it("seeds companies and a populated public board", async () => {
    // The seed contract changed: it now creates a few companies, each owned by
    // a real recruiter account, rather than fourteen ownerless ones. The
    // numbers below track that contract — what matters is that the public
    // board is not empty and every company has an owner.
    const svc = serviceClient();

    const { data: companies, error: cErr } = await svc
      .from("companies")
      .select("id, owner_id");
    expect(cErr).toBeNull();
    expect((companies ?? []).length).toBeGreaterThanOrEqual(3);

    // The old seed left owner_id null, which meant nobody could administer the
    // company it created. Every seeded company must now have an owner.
    for (const company of companies ?? []) {
      expect(company.owner_id).not.toBeNull();
    }

    const { count: jobCount, error: jErr } = await svc
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");
    expect(jErr).toBeNull();
    expect(jobCount ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("has a real seeded company with published jobs (Northwind Labs)", async () => {
    const svc = serviceClient();

    const { data: company } = await svc
      .from("companies")
      .select("id")
      .eq("slug", "northwind-labs")
      .maybeSingle();
    expect(company).not.toBeNull();

    // Asserted by relationship rather than by a hardcoded job slug: the seed
    // derives slugs positionally, so pinning one would break every time the
    // demo set is reordered without telling us anything useful.
    const { count } = await svc
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company!.id)
      .eq("status", "published");
    expect(count ?? 0).toBeGreaterThan(0);
  });
});
