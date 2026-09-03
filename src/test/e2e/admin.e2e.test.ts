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
import { reportCompany } from "@/features/companies/actions";
import { getJobs } from "@/features/jobs/data";
import { getAdminAnalytics } from "@/features/admin/analytics";
import {
  getAdminEmails,
  getReportsAdmin,
} from "@/features/admin/data";
import {
  addAdminEmail,
  adminDeleteJob,
  emailCompany,
  reinstateCompany,
  removeAdminEmail,
  resolveReport,
  suspendCompany,
  updateOwnPassword,
} from "@/features/admin/actions";

const stamp = uniq("x");
const adminEmail = `e2e-ad-admin-${stamp}@perch.test`;
const recruiterEmail = `e2e-ad-recruiter-${stamp}@perch.test`;
const seekerEmail = `e2e-ad-seeker-${stamp}@perch.test`;
const extraAdminEmail = `e2e-ad-extra-${stamp}@perch.test`;

let companyId = "";
let jobId = "";
let reportId = "";

beforeAll(async () => {
  await makeAdmin(adminEmail);
  const recruiterId = await makeUser(recruiterEmail, "recruiter", "Rae Recruiter");
  await makeUser(seekerEmail, "seeker", "Sid Seeker");

  companyId = (
    await seedRow("seed AD company", "companies", {
      owner_id: recruiterId,
      name: `AD Co ${stamp}`,
      slug: `ad-co-${stamp}`,
    })
  ).id;
  jobId = (
    await seedRow("seed AD job", "jobs", {
      slug: `ad-job-${stamp}`,
      company_id: companyId,
      title: "Admin-tested Role",
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
    })
  ).id;
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("owner_id", null).eq("name", `AD Co ${stamp}`);
  await svc.from("companies").delete().eq("id", companyId);
  await cleanupAdminEmail(adminEmail);
  await cleanupAdminEmail(extraAdminEmail);
  await cleanupUsers();
});

describe("reports", () => {
  it("a seeker can report; the owner cannot report themselves", async () => {
    await actingAs(seekerEmail);
    expect((await reportCompany(companyId, { reason: "spam", detail: "junk" })).ok).toBe(true);

    await actingAs(recruiterEmail);
    const own = await reportCompany(companyId, { reason: "spam" });
    expect(own.ok).toBe(false);
  });

  it("an admin sees the report and can resolve it", async () => {
    await actingAs(adminEmail);
    const open = await getReportsAdmin("open");
    const mine = open.find((r) => r.companyId === companyId);
    expect(mine).toBeTruthy();
    reportId = mine!.id;

    expect((await resolveReport(reportId, "reviewed")).ok).toBe(true);
    const reviewed = await getReportsAdmin("reviewed");
    expect(reviewed.some((r) => r.id === reportId)).toBe(true);
  });
});

describe("suspension", () => {
  it("suspend hides the company's jobs from the public board; reinstate restores", async () => {
    await actingAs(adminEmail);

    const s = await suspendCompany(companyId, "posting spam");
    expect(s.ok).toBe(true);

    // Check the PUBLIC board (as a guest — admins deliberately see everything).
    actingAsGuest();
    const publicJobs = await getJobs();
    expect(publicJobs.some((j) => j.id === jobId)).toBe(false);

    await actingAs(adminEmail);
    const r = await reinstateCompany(companyId);
    expect(r.ok).toBe(true);

    actingAsGuest();
    const publicJobsAfter = await getJobs();
    expect(publicJobsAfter.some((j) => j.id === jobId)).toBe(true);
  });
});

describe("owner email", () => {
  it("emailCompany logs cleanly when no provider is configured", async () => {
    await actingAs(adminEmail);
    const r = await emailCompany({
      companyId,
      subject: "Please review your posts",
      body: "Some of your recent job posts look misleading. Please update them.",
    });
    expect(r.ok).toBe(true);
    // Without RESEND_API_KEY the action still succeeds and says so.
    expect(r.message).toMatch(/configured|Emailed/i);
  });
});

describe("settings", () => {
  it("manages the admin allow-list with guards", async () => {
    await actingAs(adminEmail);

    expect((await addAdminEmail(extraAdminEmail)).ok).toBe(true);
    expect(await getAdminEmails()).toContain(extraAdminEmail.toLowerCase());

    const self = await removeAdminEmail(adminEmail);
    expect(self.ok).toBe(false); // can't remove yourself

    expect((await removeAdminEmail(extraAdminEmail)).ok).toBe(true);
    expect(await getAdminEmails()).not.toContain(extraAdminEmail.toLowerCase());
  });

  it("changes the admin's own password", async () => {
    await actingAs(adminEmail);
    expect((await updateOwnPassword("short")).ok).toBe(false);
    expect((await updateOwnPassword("a-longer-password-1")).ok).toBe(true);
  });
});

describe("analytics + delete + guard", () => {
  it("analytics returns a well-formed payload", async () => {
    await actingAs(adminEmail);
    const a = await getAdminAnalytics(30);
    expect(a.signups).toHaveLength(30);
    expect(a.jobs).toHaveLength(30);
    expect(a.totals.users).toBeGreaterThan(0);
    expect(Array.isArray(a.topCompanies)).toBe(true);
  });

  it("adminDeleteJob removes the job", async () => {
    await actingAs(adminEmail);
    expect((await adminDeleteJob(jobId)).ok).toBe(true);
    const jobs = await getJobs();
    expect(jobs.some((j) => j.id === jobId)).toBe(false);
  });

  it("a non-admin is bounced from an admin action", async () => {
    await actingAs(seekerEmail);
    await expect(suspendCompany(companyId, "nope")).rejects.toThrow();
  });
});
