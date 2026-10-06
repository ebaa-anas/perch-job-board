import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  actingAs,
  cleanupUsers,
  makeUser,
  retry,
  seedRow,
  service,
  uniq,
} from "@/test/e2e-helpers";
import { upsertCompany } from "@/features/companies/actions";
import { getOwnCompany } from "@/features/companies/data";

import {
  createJob,
  deleteJob,
  setJobStatus,
  updateJob,
} from "@/features/jobs/actions";
import { getOwnJob, getOwnJobs } from "@/features/jobs/data";
import { getCvUrl } from "@/features/applications/actions";
import { getJobApplicants } from "@/features/applications/data";

const stamp = uniq("x");
const recruiterEmail = `e2e-rc-recruiter-${stamp}@perch.test`;
const otherRecruiterEmail = `e2e-rc-other-${stamp}@perch.test`;
const seekerEmail = `e2e-rc-seeker-${stamp}@perch.test`;

let recruiterId = "";
let seekerId = "";
let companyId = "";
let publishedJobId = "";
let draftJobId = "";
let applicationId = "";

const jobPayload = {
  title: "Platform Engineer",
  location: "Remote",
  type: "full-time" as const,
  workMode: "remote" as const,
  experience: "senior" as const,
  salaryMin: 90000,
  salaryMax: 130000,
  description: "Own the platform layer end to end and mentor the team.",
  responsibilities: ["Run the platform", "Mentor"],
  requirements: ["5y experience", "Kubernetes"],
  perks: ["Remote"],
  tags: ["go", "k8s"],
  noExperienceRequired: false,
  visaSponsorship: false,
  language: "en" as const,
  questions: [],
};

beforeAll(async () => {
  recruiterId = await makeUser(recruiterEmail, "recruiter", "Rita Recruiter");
  await makeUser(otherRecruiterEmail, "recruiter", "Otto Other");
  seekerId = await makeUser(seekerEmail, "seeker", "Sam Seeker");
  // A pre-existing company that owns the "acme-<stamp>" slug so uniqueness kicks in.
  await seedRow("seed acme slug holder", "companies", {
    owner_id: null,
    name: `Acme ${stamp}`,
    slug: `acme-${stamp}`,
  });
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("slug", `acme-${stamp}`);
  await svc.from("companies").delete().eq("owner_id", recruiterId);
  await cleanupUsers();
});

describe("company profile", () => {
  it("validates, creates, and updates one row (not a new one each save)", async () => {
    await actingAs(recruiterEmail);

    const bad = await upsertCompany({ name: "", slug: "", language: "en" });
    expect(bad.ok).toBe(false);

    const created = await upsertCompany({
      name: `Acme ${stamp}`,
      slug: `acme-${stamp}`,
      tagline: "We make things",
      language: "en",
    });
    expect(created).toMatchObject({ ok: true });
    // slug already taken by the seeded row -> suffixed
    expect(created.ok && created.data.slug).toBe(`acme-${stamp}-2`);

    const updated = await upsertCompany({
      name: `Acme ${stamp}`,
      slug: `acme-${stamp}`,
      tagline: "We make better things",
      language: "en",
    });
    expect(updated.ok).toBe(true);

    const company = await getOwnCompany();
    expect(company?.tagline).toBe("We make better things");
    companyId = company!.id;
  });
});

describe("job lifecycle", () => {
  it("guards createJob: no fields -> fieldErrors; suspended company -> blocked", async () => {
    await actingAs(recruiterEmail);

    const invalid = await createJob(
      { ...jobPayload, title: "", description: "too short" },
      { publish: false },
    );
    expect(invalid.ok).toBe(false);

    // Suspend, then createJob and publish must be refused before touching the DB.
    await retry("suspend co", () =>
      service()
        .from("companies")
        .update({ suspended_at: new Date().toISOString(), suspended_reason: "e2e" })
        .eq("id", companyId),
    );
    const blocked = await createJob(jobPayload, { publish: true });
    expect(blocked).toMatchObject({ ok: false });
    await retry("unsuspend co", () =>
      service()
        .from("companies")
        .update({ suspended_at: null, suspended_reason: null })
        .eq("id", companyId),
    );
  });

  it("updateJob edits in place; setJobStatus closes / reopens; deleteJob removes", async () => {
    // Seed the jobs directly (RLS + createJob INSERT are covered by
    // jobs-write.integration.test.ts; this exercises the action orchestration).
    publishedJobId = (
      await seedRow("seed rc published", "jobs", {
        slug: `rc-pub-${stamp}`,
        company_id: companyId,
        title: "Staff Engineer",
        location: "Remote",
        type: "full-time",
        work_mode: "remote",
        experience: "senior",
        salary_min: 90000,
        salary_max: 130000,
        description: "x".repeat(60),
        responsibilities: ["r"],
        requirements: ["r"],
        tags: ["go"],
        status: "published",
      })
    ).id;
    draftJobId = (
      await seedRow("seed rc draft", "jobs", {
        slug: `rc-draft-${stamp}`,
        company_id: companyId,
        title: "Draft Engineer",
        location: "Remote",
        type: "full-time",
        work_mode: "remote",
        experience: "mid",
        salary_min: 10,
        salary_max: 20,
        description: "x".repeat(60),
        responsibilities: ["r"],
        requirements: ["r"],
        tags: ["go"],
        status: "draft",
      })
    ).id;

    await actingAs(recruiterEmail);
    const before = await getOwnJob(publishedJobId);
    expect(before?.status).toBe("published");

    const upd = await updateJob(publishedJobId, {
      ...jobPayload,
      title: "Staff Platform Engineer",
    });
    expect(upd).toMatchObject({ ok: true });
    const after = await getOwnJob(publishedJobId);
    expect(after?.slug).toBe(before?.slug);
    expect(after?.title).toBe("Staff Platform Engineer");

    expect((await setJobStatus(publishedJobId, "closed")).ok).toBe(true);
    expect((await getOwnJob(publishedJobId))?.status).toBe("closed");
    expect((await setJobStatus(publishedJobId, "published")).ok).toBe(true);
    expect((await getOwnJob(publishedJobId))?.status).toBe("published");

    const grouped = await getOwnJobs();
    expect(grouped.map((j) => j.id).sort()).toEqual(
      [draftJobId, publishedJobId].sort(),
    );

    expect((await deleteJob(draftJobId)).ok).toBe(true);
    expect(await getOwnJob(draftJobId)).toBeNull();
  });
});

describe("applicants + CV", () => {
  it("lists applicants and mints a CV link only for the job owner", async () => {
    const svc = service();
    const cvPath = `${seekerId}/cv.pdf`;
    await svc.storage
      .from("cvs")
      .upload(cvPath, new Blob(["%PDF-1.4 e2e"], { type: "application/pdf" }), {
        upsert: true,
        contentType: "application/pdf",
      });
    await retry("seed seeker_profile", () =>
      svc.from("seeker_profiles").upsert(
        {
          profile_id: seekerId,
          headline: "Backend dev",
          cv_path: cvPath,
          cv_filename: "sam-cv.pdf",
        },
        { onConflict: "profile_id" },
      ),
    );
    applicationId = (
      await seedRow("seed application", "applications", {
        job_id: publishedJobId,
        seeker_id: seekerId,
        note: "Hire me",
        cv_path: `${seekerId}/cv.pdf`,
        cv_filename: "sam-cv.pdf",
      })
    ).id;

    await actingAs(recruiterEmail);
    const applicants = await getJobApplicants(publishedJobId);
    expect(applicants).toHaveLength(1);
    expect(applicants[0]?.seeker.headline).toBe("Backend dev");
    expect(applicants[0]?.hasCv).toBe(true);

    const url = await getCvUrl(applicationId);
    expect(url).toMatchObject({ ok: true });
    expect(url.ok && url.url).toContain(`${seekerId}/cv.pdf`);

    await actingAs(otherRecruiterEmail);
    const denied = await getCvUrl(applicationId);
    expect(denied.ok).toBe(false);

    await svc.from("seeker_profiles").delete().eq("profile_id", seekerId);
    await svc.storage.from("cvs").remove([cvPath]);
  });
});
