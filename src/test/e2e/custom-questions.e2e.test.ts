import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { actingAs, cleanupUsers, makeUser, seedRow, service, uniq } from "@/test/e2e-helpers";
import { createJob } from "@/features/jobs/actions";
import { getJobQuestions } from "@/features/jobs/data";
import { upsertSeekerProfile } from "@/features/profiles/actions";
import { applyToJob } from "@/features/applications/actions";
import { getJobApplicants } from "@/features/applications/data";

const stamp = uniq("x");
const recruiterEmail = `e2e-cq-recruiter-${stamp}@perch.test`;
const seekerEmail = `e2e-cq-seeker-${stamp}@perch.test`;
const seekerBEmail = `e2e-cq-seeker2-${stamp}@perch.test`;

let companyId = "";
let jobId = "";

const jobPayload = {
  title: "Support Engineer",
  location: "Remote",
  type: "full-time" as const,
  workMode: "remote" as const,
  experience: "junior" as const,
  salaryMin: 40000,
  salaryMax: 55000,
  description: "x".repeat(60),
  responsibilities: ["Help customers"],
  requirements: ["Clear writing"],
  perks: [],
  tags: ["support"],
  noExperienceRequired: true,
  visaSponsorship: false,
  language: "en" as const,
  questions: [
    {
      label: "What's your notice period?",
      type: "short_text" as const,
      required: true,
      options: [],
      knockoutAnswer: "",
    },
    {
      label: "Why do you want this role?",
      type: "long_text" as const,
      required: false,
      options: [],
      knockoutAnswer: "",
    },
    {
      label: "Authorized to work remotely from the EU?",
      type: "yes_no" as const,
      required: true,
      options: [],
      knockoutAnswer: "",
    },
    {
      label: "Preferred start date",
      type: "multiple_choice" as const,
      required: true,
      options: ["Immediately", "Within 1 month", "Within 3 months"],
      knockoutAnswer: "",
    },
  ],
};

beforeAll(async () => {
  const recruiterId = await makeUser(recruiterEmail, "recruiter", "CQ Recruiter");
  await makeUser(seekerEmail, "seeker", "CQ Seeker");
  await makeUser(seekerBEmail, "seeker", "CQ Seeker Two");

  companyId = (
    await seedRow("cq company", "companies", {
      owner_id: recruiterId,
      name: `CQ Co ${stamp}`,
      slug: `cq-co-${stamp}`,
    })
  ).id;

  await actingAs(recruiterEmail);
  const created = await createJob(jobPayload, { publish: true });
  if (!created.ok) throw new Error(`createJob failed: ${created.error}`);
  jobId = created.data.id;
});

afterAll(async () => {
  const svc = service();
  await svc.from("companies").delete().eq("id", companyId);
  await cleanupUsers();
});

describe("per-job custom application questions", () => {
  it("persists all 4 question types in order via createJob", async () => {
    const questions = await getJobQuestions(jobId);
    expect(questions).toHaveLength(4);
    expect(questions.map((q) => q.type)).toEqual([
      "short_text",
      "long_text",
      "yes_no",
      "multiple_choice",
    ]);
    expect(questions[3].options).toEqual(["Immediately", "Within 1 month", "Within 3 months"]);
    expect(questions[1].required).toBe(false);
  });

  it("rejects an apply missing a required answer", async () => {
    await actingAs(seekerEmail);
    await upsertSeekerProfile({ headline: "Support specialist", skills: ["Zendesk"] });

    const questions = await getJobQuestions(jobId);
    const shortText = questions.find((q) => q.type === "short_text")!;

    const result = await applyToJob({
      jobId,
      answers: { [shortText.id]: "" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("rejects a multiple_choice answer outside the defined options", async () => {
    await actingAs(seekerBEmail);
    await upsertSeekerProfile({ headline: "Support specialist", skills: [] });

    const questions = await getJobQuestions(jobId);
    const shortText = questions.find((q) => q.type === "short_text")!;
    const yesNo = questions.find((q) => q.type === "yes_no")!;
    const choice = questions.find((q) => q.type === "multiple_choice")!;

    const result = await applyToJob({
      jobId,
      answers: { [shortText.id]: "Two weeks", [yesNo.id]: true, [choice.id]: "Whenever" },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a full valid apply and the recruiter sees the answer snapshot", async () => {
    await actingAs(seekerEmail);
    const questions = await getJobQuestions(jobId);
    const shortText = questions.find((q) => q.type === "short_text")!;
    const longText = questions.find((q) => q.type === "long_text")!;
    const yesNo = questions.find((q) => q.type === "yes_no")!;
    const choice = questions.find((q) => q.type === "multiple_choice")!;

    const result = await applyToJob({
      jobId,
      note: "Keen to join",
      attachCv: false,
      answers: {
        [shortText.id]: "Two weeks",
        [longText.id]: "",
        [yesNo.id]: true,
        [choice.id]: "Within 1 month",
      },
    });
    expect(result.ok).toBe(true);

    await actingAs(recruiterEmail);
    const applicants = await getJobApplicants(jobId);
    const applicant = applicants.find((a) => a.seeker.headline === "Support specialist" && a.note === "Keen to join");
    expect(applicant).toBeDefined();
    expect(applicant!.customAnswers).toHaveLength(4);

    const byLabel = Object.fromEntries(applicant!.customAnswers.map((a) => [a.label, a.answer]));
    expect(byLabel["What's your notice period?"]).toBe("Two weeks");
    expect(byLabel["Authorized to work remotely from the EU?"]).toBe(true);
    expect(byLabel["Preferred start date"]).toBe("Within 1 month");
  });
});
