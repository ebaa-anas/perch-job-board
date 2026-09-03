import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  actingAs,
  cleanupUsers,
  expectRedirect,
  makeUser,
  seedRow,
  service,
  uniq,
} from "@/test/e2e-helpers";
import { getProfile } from "@/features/auth/session";
import {
  removeCv,
  setCv,
  upsertSeekerProfile,
} from "@/features/profiles/actions";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { applyToJob, withdrawApplication } from "@/features/applications/actions";
import { getMyApplications, hasApplied } from "@/features/applications/data";
import {
  listSavedJobIds,
  mergeGuestSavedJobs,
  saveJob,
  unsaveJob,
} from "@/features/saved-jobs/actions";
import { upsertCompany } from "@/features/companies/actions";

const stamp = uniq("x");
const seekerEmail = `e2e-sk-seeker-${stamp}@perch.test`;
const recruiterEmail = `e2e-sk-recruiter-${stamp}@perch.test`;

let seekerId = "";
let publishedJobId = "";
let draftJobId = "";

beforeAll(async () => {
  seekerId = await makeUser(seekerEmail, "seeker", "Sky Seeker");
  const recruiterId = await makeUser(recruiterEmail, "recruiter", "Ray Recruiter");

  const company = await seedRow("seed SK company", "companies", {
    owner_id: recruiterId,
    name: `SK Co ${stamp}`,
    slug: `sk-co-${stamp}`,
  });

  const base = {
    company_id: company.id,
    location: "Remote",
    type: "full-time",
    work_mode: "remote",
    experience: "mid",
    salary_min: 10,
    salary_max: 20,
    description: "x".repeat(60),
    responsibilities: ["r"],
    requirements: ["r"],
    tags: ["t"],
  };
  publishedJobId = (
    await seedRow("seed SK pub job", "jobs", {
      ...base,
      slug: `sk-pub-${stamp}`,
      title: "Published Role",
      status: "published",
    })
  ).id;
  draftJobId = (
    await seedRow("seed SK draft job", "jobs", {
      ...base,
      slug: `sk-draft-${stamp}`,
      title: "Draft Role",
      status: "draft",
    })
  ).id;
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("name", `SK Co ${stamp}`);
  await cleanupUsers();
});

describe("seeker profile", () => {
  it("rejects an over-long bio, then saves a valid profile", async () => {
    await actingAs(seekerEmail);

    const bad = await upsertSeekerProfile({
      bio: "x".repeat(2100),
      skills: [],
    });
    expect(bad.ok).toBe(false);

    const good = await upsertSeekerProfile({
      headline: "Frontend engineer",
      location: "Berlin",
      bio: "I build things.",
      skills: ["react", "ts"],
    });
    expect(good.ok).toBe(true);

    const saved = await getOwnSeekerProfile();
    expect(saved?.headline).toBe("Frontend engineer");
    expect(saved?.skills).toEqual(["react", "ts"]);
  });

  it("guards CV path to the seeker's own folder", async () => {
    await actingAs(seekerEmail);
    const bad = await setCv({ path: `someone-else/cv.pdf`, filename: "cv.pdf" });
    expect(bad.ok).toBe(false);

    const good = await setCv({ path: `${seekerId}/cv.pdf`, filename: "my-cv.pdf" });
    expect(good.ok).toBe(true);
    expect((await getOwnSeekerProfile())?.cvFilename).toBe("my-cv.pdf");
  });
});

describe("applying", () => {
  it("blocks a draft job", async () => {
    await actingAs(seekerEmail);
    const r = await applyToJob({ jobId: draftJobId, note: "hi" });
    expect(r.ok).toBe(false);
  });

  it("applies once, then reports already-applied on a repeat", async () => {
    await actingAs(seekerEmail);
    const first = await applyToJob({ jobId: publishedJobId, note: "keen", attachCv: true });
    expect(first).toEqual({ ok: true });
    expect(await hasApplied(publishedJobId)).toBe(true);

    const again = await applyToJob({ jobId: publishedJobId });
    expect(again).toEqual({ ok: true, alreadyApplied: true });

    const mine = await getMyApplications();
    expect(mine.map((a) => a.job.id)).toContain(publishedJobId);
    expect(mine[0]?.job.company.name).toContain("SK Co");
  });

  it("can be withdrawn", async () => {
    await actingAs(seekerEmail);
    const app = (await getMyApplications()).find((a) => a.job.id === publishedJobId);
    expect(app).toBeTruthy();
    const r = await withdrawApplication(app!.id);
    expect(r.ok).toBe(true);
    expect(await hasApplied(publishedJobId)).toBe(false);
  });
});

describe("saved jobs", () => {
  it("save / unsave / merge round-trips", async () => {
    await actingAs(seekerEmail);
    expect((await saveJob(publishedJobId)).ok).toBe(true);
    expect(await listSavedJobIds()).toContain(publishedJobId);
    expect((await unsaveJob(publishedJobId)).ok).toBe(true);
    expect(await listSavedJobIds()).not.toContain(publishedJobId);

    const merged = await mergeGuestSavedJobs([
      publishedJobId,
      "00000000-0000-0000-0000-000000000000",
      "not-a-uuid",
    ]);
    expect(merged).toEqual([publishedJobId]);
    await unsaveJob(publishedJobId);
  });
});

describe("role guard", () => {
  it("a seeker cannot use a recruiter action", async () => {
    await actingAs(seekerEmail);
    const to = await expectRedirect(
      upsertCompany({ name: "Nope", slug: "nope" }),
    );
    expect(to).toBe("/");
  });

  it("cleanup: remove the CV row", async () => {
    await actingAs(seekerEmail);
    expect((await removeCv()).ok).toBe(true);
    expect(await getProfile()).toBeTruthy();
  });
});
