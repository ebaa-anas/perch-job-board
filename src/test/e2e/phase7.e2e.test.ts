import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  actingAs,
  actingAsGuest,
  cleanupAdminEmail,
  cleanupUsers,
  makeAdmin,
  makeUser,
  seedRow,
  service,
  uniq,
} from "@/test/e2e-helpers";
import { applyToJob } from "@/features/applications/actions";
import { getApplyRecord, getJobApplicants, getMyApplications } from "@/features/applications/data";
import {
  deleteOwnReview,
  upsertReview,
} from "@/features/companies/reviews-actions";
import {
  getCompanyReviews,
  getOwnReview,
  getReviewSummary,
} from "@/features/companies/reviews";
import { adminDeleteReview, adminSetReviewStatus } from "@/features/admin/actions";
import { getUserAdminDetail } from "@/features/admin/data";

const stamp = uniq("x");
const adminEmail = `e2e-p7-admin-${stamp}@perch.test`;
const recruiterEmail = `e2e-p7-recruiter-${stamp}@perch.test`;
const seekerEmail = `e2e-p7-seeker-${stamp}@perch.test`;
const seekerBEmail = `e2e-p7-seeker2-${stamp}@perch.test`;

let recruiterId = "";
let seekerId = "";
let companyId = "";
let onsiteJobId = "";
let externalJobId = "";

beforeAll(async () => {
  await makeAdmin(adminEmail);
  recruiterId = await makeUser(recruiterEmail, "recruiter", "P7 Recruiter");
  seekerId = await makeUser(seekerEmail, "seeker", "P7 Seeker");
  await makeUser(seekerBEmail, "seeker", "P7 Seeker Two");

  companyId = (
    await seedRow("p7 company", "companies", {
      owner_id: recruiterId,
      name: `P7 Co ${stamp}`,
      slug: `p7-co-${stamp}`,
    })
  ).id;

  const base = {
    company_id: companyId,
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
    status: "published",
  };
  onsiteJobId = (
    await seedRow("p7 onsite job", "jobs", {
      ...base,
      slug: `p7-onsite-${stamp}`,
      title: "Onsite Role",
    })
  ).id;
  externalJobId = (
    await seedRow("p7 external job", "jobs", {
      ...base,
      slug: `p7-external-${stamp}`,
      title: "External Role",
      apply_url: "https://example.com/apply",
    })
  ).id;

  // seeker needs a headline for on-site applies
  await service()
    .from("seeker_profiles")
    .upsert(
      { profile_id: seekerId, headline: "Engineer" },
      { onConflict: "profile_id" },
    );
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("id", companyId);
  await svc.from("seeker_profiles").delete().eq("profile_id", seekerId);
  await cleanupAdminEmail(adminEmail);
  await cleanupUsers();
});

describe("external-apply tracking", () => {
  it("records an external click-through and shows it to both sides", async () => {
    await actingAs(seekerEmail);
    const r = await applyToJob({ jobId: externalJobId, external: true });
    expect(r).toEqual({ ok: true });

    const record = await getApplyRecord(externalJobId);
    expect(record?.via).toBe("external");

    const mine = await getMyApplications();
    const row = mine.find((a) => a.job.id === externalJobId);
    expect(row?.via).toBe("external");

    await actingAs(recruiterEmail);
    const applicants = await getJobApplicants(externalJobId);
    expect(applicants).toHaveLength(1);
    expect(applicants[0]?.via).toBe("external");
  });

  it("rejects external=true on an on-site job and vice versa", async () => {
    await actingAs(seekerEmail);
    expect((await applyToJob({ jobId: onsiteJobId, external: true })).ok).toBe(false);
    expect((await applyToJob({ jobId: externalJobId, note: "hi" })).ok).toBe(false);
  });

  it("a normal on-site apply still works", async () => {
    await actingAs(seekerEmail);
    const r = await applyToJob({ jobId: onsiteJobId, note: "keen", attachCv: false });
    expect(r).toEqual({ ok: true });
    expect((await getApplyRecord(onsiteJobId))?.via).toBe("onsite");
  });
});

describe("company reviews", () => {
  it("a seeker can post then update one review; summary reflects it", async () => {
    await actingAs(seekerEmail);
    expect((await upsertReview(companyId, { rating: 4, title: "Good", body: "Solid team" })).ok).toBe(true);

    let summary = await getReviewSummary(companyId);
    expect(summary.count).toBe(1);
    expect(summary.avg).toBe(4);

    // update (unique constraint -> upsert)
    expect((await upsertReview(companyId, { rating: 2, body: "Changed my mind" })).ok).toBe(true);
    summary = await getReviewSummary(companyId);
    expect(summary.count).toBe(1);
    expect(summary.avg).toBe(2);

    const own = await getOwnReview(companyId);
    expect(own?.rating).toBe(2);
  });

  it("a second seeker adds a review — average is the mean", async () => {
    await actingAs(seekerBEmail);
    expect((await upsertReview(companyId, { rating: 4 })).ok).toBe(true);
    const summary = await getReviewSummary(companyId);
    expect(summary.count).toBe(2);
    expect(summary.avg).toBe(3); // (2 + 4) / 2
  });

  it("a recruiter cannot review (bounced by the seeker-role guard)", async () => {
    await actingAs(recruiterEmail);
    await expect(upsertReview(companyId, { rating: 5 })).rejects.toThrow();
  });

  it("an admin can hide a review — it drops out of the public summary", async () => {
    await actingAs(seekerEmail);
    const before = await getReviewSummary(companyId);
    expect(before.count).toBe(2);

    // find the seeker's own review id via the admin-visible list
    await actingAs(adminEmail);
    const all = await getCompanyReviews(companyId);
    const target = all.find((x) => x.rating === 2);
    expect(target).toBeTruthy();
    expect((await adminSetReviewStatus(target!.id, "hidden")).ok).toBe(true);

    actingAsGuest();
    const after = await getReviewSummary(companyId);
    expect(after.count).toBe(1);
    expect(after.avg).toBe(4);

    // restore + delete for cleanup
    await actingAs(adminEmail);
    await adminSetReviewStatus(target!.id, "visible");
    await actingAs(seekerEmail);
    await deleteOwnReview(companyId);
    await actingAs(seekerBEmail);
    await deleteOwnReview(companyId);
  });

  it("admin can delete any review", async () => {
    await actingAs(seekerEmail);
    await upsertReview(companyId, { rating: 1, body: "temp" });
    await actingAs(adminEmail);
    const list = await getCompanyReviews(companyId);
    expect(list.length).toBeGreaterThan(0);
    expect((await adminDeleteReview(list[0]!.id)).ok).toBe(true);
    expect(await getCompanyReviews(companyId)).toHaveLength(0);
  });
});

describe("admin user detail", () => {
  it("shows a seeker's profile + applications", async () => {
    await actingAs(adminEmail);
    const detail = await getUserAdminDetail(seekerId);
    expect(detail?.role).toBe("seeker");
    expect(detail?.seeker?.headline).toBe("Engineer");
    expect(detail?.applications.length).toBeGreaterThanOrEqual(1);
  });

  it("links a recruiter to their company", async () => {
    await actingAs(adminEmail);
    const detail = await getUserAdminDetail(recruiterId);
    expect(detail?.role).toBe("recruiter");
    expect(detail?.company?.id).toBe(companyId);
  });
});
