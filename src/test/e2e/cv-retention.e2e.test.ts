import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { removeCv, setCv } from "@/features/profiles/actions";
import {
  actingAs,
  cleanupUsers,
  makeUser,
  seedRow,
  service,
} from "@/test/e2e-helpers";

/**
 * A seeker tidying up their profile must not break a recruiter's inbox.
 *
 * `applications.cv_path` is a snapshot taken at apply time, and 0005 promises
 * the job's owner can download exactly what was sent. `removeCv` used to delete
 * the storage object outright, which turned every past application into a dead
 * link. It now detaches the CV from the profile and deletes the object only
 * when nothing references it; `setCv` cleans up a replaced CV under the same
 * rule, instead of leaking it forever as it did before.
 *
 * App-level behaviour, so no part of this waits on migration 0014.
 */

const stamp = Date.now();

const seeker = { email: `e2e-cvret-seeker-${stamp}@perch.test`, id: "" };
const recruiter = { email: `e2e-cvret-rec-${stamp}@perch.test`, id: "" };

let companyId = "";
let jobId = "";
// `applications` is unique on (job_id, seeker_id), so the two tests that each
// need an application from this seeker need a job each.
let secondJobId = "";
const uploaded: string[] = [];

async function uploadCv(name: string): Promise<string> {
  const path = `${seeker.id}/${name}`;
  const { error } = await service()
    .storage.from("cvs")
    .upload(path, new TextEncoder().encode("%PDF-1.4 cv"), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw new Error(`upload(${path}) failed: ${error.message}`);
  uploaded.push(path);
  return path;
}

async function objectExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await service()
    .storage.from("cvs")
    .list(path.slice(0, slash), { search: path.slice(slash + 1) });
  if (error) throw new Error(`list failed: ${error.message}`);
  return (data ?? []).some((o) => o.name === path.slice(slash + 1));
}

beforeAll(async () => {
  seeker.id = await makeUser(seeker.email, "seeker", "CV Retention Seeker");
  recruiter.id = await makeUser(recruiter.email, "recruiter", "CV Retention Rec");

  const company = await seedRow("company", "companies", {
    owner_id: recruiter.id,
    name: `CV Retention Co ${stamp}`,
    slug: `cv-retention-co-${stamp}`,
  });
  companyId = company.id;

  const jobFixture = (slug: string, title: string) => ({
    company_id: companyId,
    slug,
    title,
    location: "Remote",
    type: "full-time",
    work_mode: "remote",
    experience: "junior",
    salary_min: 40000,
    salary_max: 60000,
    description: "seeded by the CV retention e2e test".padEnd(60, "."),
    status: "published",
  });

  jobId = (
    await seedRow("job", "jobs", jobFixture(`cv-retention-job-${stamp}`, "CV Retention Role"))
  ).id;
  secondJobId = (
    await seedRow("job 2", "jobs", jobFixture(`cv-retention-job-2-${stamp}`, "CV Retention Role 2"))
  ).id;
});

afterAll(async () => {
  const svc = service();
  for (const id of [jobId, secondJobId]) {
    if (!id) continue;
    await svc.from("applications").delete().eq("job_id", id);
    await svc.from("jobs").delete().eq("id", id);
  }
  if (companyId) await svc.from("companies").delete().eq("id", companyId);
  if (uploaded.length) await svc.storage.from("cvs").remove(uploaded);
  await cleanupUsers();
});

describe("removeCv", () => {
  it("keeps the stored file when an application still references it", async () => {
    const path = await uploadCv(`applied-${stamp}.pdf`);

    await actingAs(seeker.email);
    expect(await setCv({ path, filename: "applied.pdf" })).toEqual({ ok: true });

    // The snapshot a recruiter will later download.
    await seedRow("application", "applications", {
      job_id: jobId,
      seeker_id: seeker.id,
      cv_path: path,
      note: "seeded by the CV retention e2e test",
    });

    await actingAs(seeker.email);
    expect(await removeCv()).toEqual({ ok: true });

    // Profile no longer advertises it...
    const { data: profile } = await service()
      .from("seeker_profiles")
      .select("cv_path, cv_filename")
      .eq("profile_id", seeker.id)
      .maybeSingle();
    expect(profile?.cv_path).toBeNull();
    expect(profile?.cv_filename).toBeNull();

    // ...but the recruiter's copy survives.
    expect(await objectExists(path)).toBe(true);
  });

  it("deletes the stored file when nothing references it", async () => {
    const path = await uploadCv(`unreferenced-${stamp}.pdf`);

    await actingAs(seeker.email);
    expect(await setCv({ path, filename: "unreferenced.pdf" })).toEqual({ ok: true });
    expect(await removeCv()).toEqual({ ok: true });

    expect(await objectExists(path)).toBe(false);
  });
});

describe("setCv replacing an existing CV", () => {
  it("deletes the replaced file when nothing references it", async () => {
    const oldPath = await uploadCv(`replaced-old-${stamp}.pdf`);
    const newPath = await uploadCv(`replaced-new-${stamp}.pdf`);

    await actingAs(seeker.email);
    expect(await setCv({ path: oldPath, filename: "old.pdf" })).toEqual({ ok: true });
    expect(await setCv({ path: newPath, filename: "new.pdf" })).toEqual({ ok: true });

    expect(await objectExists(oldPath)).toBe(false);
    expect(await objectExists(newPath)).toBe(true);
  });

  it("keeps the replaced file when an application references it", async () => {
    const oldPath = await uploadCv(`kept-old-${stamp}.pdf`);
    const newPath = await uploadCv(`kept-new-${stamp}.pdf`);

    await actingAs(seeker.email);
    expect(await setCv({ path: oldPath, filename: "old.pdf" })).toEqual({ ok: true });

    await seedRow("application", "applications", {
      job_id: secondJobId,
      seeker_id: seeker.id,
      cv_path: oldPath,
      note: "second application, seeded by the CV retention e2e test",
    });

    await actingAs(seeker.email);
    expect(await setCv({ path: newPath, filename: "new.pdf" })).toEqual({ ok: true });

    expect(await objectExists(oldPath)).toBe(true);
    expect(await objectExists(newPath)).toBe(true);
  });

  it("rejects a path outside the seeker's own folder", async () => {
    await actingAs(seeker.email);
    const result = await setCv({
      path: `${recruiter.id}/not-mine.pdf`,
      filename: "not-mine.pdf",
    });
    expect(result).toEqual({
      ok: false,
      error: "That file isn't in your folder.",
    });
  });
});
