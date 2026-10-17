import { describe, expect, it } from "vitest";

import { canTransition, type ApplicationStage } from "@/features/applications/pipeline";
import { computeCompleteness } from "@/features/profiles/completeness";
import { DEMO_ACCOUNTS, isDemoUser } from "@/features/demo/demo-rules";
import {
  SEED_ACCOUNTS,
  SEED_APPLICATIONS,
  SEED_COMPANIES,
  SEED_JOB_PLAN,
  SEED_SAVED_JOBS,
  SEED_SEEKER_PROFILES,
  SEED_TEAM_MEMBERS,
} from "@/features/demo/seed-plan";

const accountKeys = new Set(SEED_ACCOUNTS.map((account) => account.key));
const jobByKey = new Map(SEED_JOB_PLAN.map((job) => [job.key, job]));
const currentStage = (app: (typeof SEED_APPLICATIONS)[number]): ApplicationStage =>
  app.steps.at(-1)?.stage ?? "applied";

describe("accounts", () => {
  it("are all on the demo domain, so the reset can find every one", () => {
    for (const account of SEED_ACCOUNTS) expect(isDemoUser(account.email), account.email).toBe(true);
  });

  it("never include an admin", () => {
    for (const account of SEED_ACCOUNTS) expect(["seeker", "recruiter"]).toContain(account.role);
  });

  it("include exactly the two shared logins, with the right roles", () => {
    const shared = SEED_ACCOUNTS.filter((account) => account.demoRole);
    expect(shared).toHaveLength(2);
    for (const account of shared) {
      expect(account.email).toBe(DEMO_ACCOUNTS[account.demoRole!].email);
      expect(account.role).toBe(account.demoRole);
    }
  });

  it("have unique keys and addresses", () => {
    expect(accountKeys.size).toBe(SEED_ACCOUNTS.length);
    expect(new Set(SEED_ACCOUNTS.map((a) => a.email)).size).toBe(SEED_ACCOUNTS.length);
  });
});

describe("the demo seeker", () => {
  const profile = SEED_SEEKER_PROFILES.find((p) => p.account === "demo-seeker")!;
  const applications = SEED_APPLICATIONS.filter((app) => app.seeker === "demo-seeker");

  it("has a complete profile", () => {
    const completeness = computeCompleteness({
      headline: profile.headline,
      bio: profile.bio,
      skills: profile.skills,
      hasCv: true,
      experience: profile.experience,
      noProfessionalExperience: profile.noProfessionalExperience,
      needsVisaSponsorship: profile.needsVisaSponsorship,
      desiredTypes: profile.desiredTypes,
      desiredWorkModes: profile.desiredWorkModes,
    });
    expect(completeness.percent).toBe(100);
  });

  it("has applications in different stages, from submitted to an offer", () => {
    const stages = new Set(applications.map(currentStage));
    expect(stages.size).toBeGreaterThanOrEqual(5);
    for (const stage of ["applied", "interview", "offer", "rejected"] as const) {
      expect(stages, stage).toContain(stage);
    }
  });

  it("has saved jobs it has not applied to", () => {
    const applied = new Set(applications.map((app) => app.job));
    const saved = SEED_SAVED_JOBS.filter((s) => s.seeker === "demo-seeker");
    expect(saved.length).toBeGreaterThanOrEqual(2);
    for (const s of saved) expect(applied.has(s.job), s.job).toBe(false);
  });
});

describe("the demo recruiter", () => {
  const company = SEED_COMPANIES.find((c) => c.owner === "demo-recruiter")!;
  const jobs = SEED_JOB_PLAN.filter((job) => job.company === company.key);
  const applicants = SEED_APPLICATIONS.filter((app) => jobByKey.get(app.job)?.company === company.key);

  it("owns a verified company", () => {
    expect(company).toBeDefined();
    expect(company.verifiedDomain).toBeTruthy();
  });

  it("has several live jobs", () => {
    expect(jobs.filter((job) => job.status === "published").length).toBeGreaterThanOrEqual(3);
  });

  it("has applicants to work with, the demo seeker among them", () => {
    expect(new Set(applicants.map((app) => app.seeker)).size).toBeGreaterThanOrEqual(4);
    expect(applicants.some((app) => app.seeker === "demo-seeker")).toBe(true);
  });

  it("shares the team with a seeded colleague, not a real person", () => {
    for (const member of SEED_TEAM_MEMBERS) expect(accountKeys.has(member.account)).toBe(true);
  });
});

describe("applications", () => {
  it("point at seeded seekers and jobs, once per pair", () => {
    const pairs = new Set<string>();
    for (const app of SEED_APPLICATIONS) {
      expect(SEED_SEEKER_PROFILES.some((p) => p.account === app.seeker), app.seeker).toBe(true);
      expect(jobByKey.get(app.job)?.status, app.job).toBe("published");
      const pair = `${app.seeker}:${app.job}`;
      expect(pairs.has(pair), pair).toBe(false);
      pairs.add(pair);
    }
  });

  it("move through legal stage changes, in order, after being submitted", () => {
    for (const app of SEED_APPLICATIONS) {
      let from: ApplicationStage = "applied";
      let previousDay = app.daysAgo;
      for (const step of app.steps) {
        expect(canTransition(from, step.stage), `${app.seeker} → ${app.job}`).toBe(true);
        expect(step.daysAgo).toBeLessThan(previousDay);
        from = step.stage;
        previousDay = step.daysAgo;
      }
    }
  });

  it("pass their own job's screening gates", () => {
    for (const app of SEED_APPLICATIONS) {
      const questions = jobByKey.get(app.job)?.questions ?? [];
      questions.forEach((question, index) => {
        if (!question.knockoutAnswer) return;
        const answer = app.answers[index];
        const normalised = typeof answer === "boolean" ? (answer ? "yes" : "no") : String(answer);
        expect(normalised, `${app.seeker} → ${question.label}`).toBe(question.knockoutAnswer);
      });
    }
  });
});

describe("jobs and companies", () => {
  it("use unique slugs", () => {
    expect(new Set(SEED_JOB_PLAN.map((job) => job.slug)).size).toBe(SEED_JOB_PLAN.length);
    expect(new Set(SEED_COMPANIES.map((c) => c.slug)).size).toBe(SEED_COMPANIES.length);
  });

  it("have sane salary ranges", () => {
    for (const job of SEED_JOB_PLAN) expect(job.salaryMin, job.slug).toBeLessThanOrEqual(job.salaryMax);
  });

  it("link only to reserved .example domains, never to a real site", () => {
    const urls = [
      ...SEED_COMPANIES.map((c) => c.website),
      ...SEED_SEEKER_PROFILES.map((p) => p.portfolioUrl),
    ].filter((url): url is string => Boolean(url));
    for (const url of urls) expect(new URL(url).hostname.endsWith(".example"), url).toBe(true);
  });
});
