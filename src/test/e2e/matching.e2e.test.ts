import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { actingAs, actingAsGuest, cleanupUsers, makeUser, seedRow, service, uniq } from "@/test/e2e-helpers";
import { upsertSeekerProfile } from "@/features/profiles/actions";
import { getFitScore } from "@/features/matching/actions";

const stamp = uniq("x");
const seekerEmail = `e2e-fit-seeker-${stamp}@perch.test`;
const recruiterEmail = `e2e-fit-recruiter-${stamp}@perch.test`;

let publishedJobId = "";

beforeAll(async () => {
  await makeUser(seekerEmail, "seeker", "Fiona Fitcheck");
  const recruiterId = await makeUser(recruiterEmail, "recruiter", "Ray Recruiter");

  const company = await seedRow("seed FIT company", "companies", {
    owner_id: recruiterId,
    name: `FIT Co ${stamp}`,
    slug: `fit-co-${stamp}`,
  });

  publishedJobId = (
    await seedRow("seed FIT job", "jobs", {
      company_id: company.id,
      slug: `fit-job-${stamp}`,
      title: "Frontend Engineer",
      location: "Remote",
      type: "full-time",
      work_mode: "remote",
      experience: "mid",
      salary_min: 60000,
      salary_max: 90000,
      description: "x".repeat(60),
      responsibilities: ["Ship features"],
      requirements: ["React experience"],
      tags: ["React"],
      status: "published",
    })
  ).id;
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("name", `FIT Co ${stamp}`);
  await cleanupUsers();
});

describe("getFitScore", () => {
  it("returns signed-out for a guest", async () => {
    actingAsGuest();
    expect(await getFitScore(publishedJobId)).toEqual({ ok: false, reason: "signed-out" });
  });

  it("returns not-found for a job id that doesn't exist", async () => {
    await actingAs(seekerEmail);
    const result = await getFitScore("00000000-0000-0000-0000-000000000000");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns no-profile for a seeker with an empty profile", async () => {
    await actingAs(seekerEmail);
    const result = await getFitScore(publishedJobId);
    expect(result).toEqual({ ok: false, reason: "no-profile" });
  });

  it("degrades to unavailable once profiled, since no ANTHROPIC_API_KEY is set in tests", async () => {
    await actingAs(seekerEmail);
    const saved = await upsertSeekerProfile({
      headline: "Frontend engineer",
      skills: ["React", "TypeScript"],
    });
    expect(saved.ok).toBe(true);

    const result = await getFitScore(publishedJobId);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
