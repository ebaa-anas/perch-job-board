import { describe, expect, it } from "vitest";
import { anonClient, serviceClient } from "@/test/setup-integration";

describe("schema + phase-1 RLS", () => {
  it("service role can insert a company and a published job", async () => {
    const svc = serviceClient();
    const { data: company, error: cErr } = await svc
      .from("companies")
      .insert({ name: "RLS Test Co", slug: `rls-test-${Date.now()}` })
      .select()
      .single();
    expect(cErr).toBeNull();

    const { error: jErr } = await svc.from("jobs").insert({
      slug: `rls-test-job-${Date.now()}`,
      company_id: company!.id,
      title: "Test",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 1,
      salary_max: 2,
      description: "x".repeat(60),
      tags: ["t"],
      responsibilities: ["r"],
      requirements: ["r"],
    });
    expect(jErr).toBeNull();

    await svc.from("companies").delete().eq("id", company!.id);
  });

  it("anon can read published jobs", async () => {
    const { data, error } = await anonClient()
      .from("jobs")
      .select("id,status")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("anon cannot insert a job (RLS denies write)", async () => {
    const { error } = await anonClient().from("jobs").insert({
      slug: `nope-${Date.now()}`,
      company_id: "00000000-0000-0000-0000-000000000000",
      title: "Nope",
      location: "x",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 1,
      salary_max: 2,
      description: "x".repeat(60),
      tags: ["t"],
      responsibilities: ["r"],
      requirements: ["r"],
    });
    expect(error).not.toBeNull(); // RLS / no policy
  });

  it("salary_max < salary_min is rejected by the check constraint", async () => {
    const svc = serviceClient();
    const { data: c } = await svc
      .from("companies")
      .insert({ name: "Chk Co", slug: `chk-${Date.now()}` })
      .select()
      .single();
    const { error } = await svc.from("jobs").insert({
      slug: `chk-job-${Date.now()}`,
      company_id: c!.id,
      title: "Test",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 100,
      salary_max: 50,
      description: "x".repeat(60),
      tags: ["t"],
      responsibilities: ["r"],
      requirements: ["r"],
    });
    expect(error).not.toBeNull();
    await svc.from("companies").delete().eq("id", c!.id);
  });
});
