import { describe, expect, it } from "vitest";

import {
  ALERT_FREQUENCIES,
  isAlertDue,
  jobsMatchingSince,
  type AlertFrequency,
} from "@/features/alerts/schedule";
import type { Job } from "@/features/jobs/types";

const NOW = new Date("2026-03-10T06:00:00.000Z");

function hoursBefore(hours: number): string {
  return new Date(NOW.getTime() - hours * 3600_000).toISOString();
}

describe("ALERT_FREQUENCIES", () => {
  it("offers daily and weekly", () => {
    expect(ALERT_FREQUENCIES).toContain("daily");
    expect(ALERT_FREQUENCIES).toContain("weekly");
  });
});

describe("isAlertDue", () => {
  it("is due when it has never run", () => {
    expect(isAlertDue("daily", null, NOW)).toBe(true);
    expect(isAlertDue("weekly", null, NOW)).toBe(true);
  });

  it("is not due for a daily alert that just ran", () => {
    expect(isAlertDue("daily", hoursBefore(1), NOW)).toBe(false);
  });

  it("is due for a daily alert a day later", () => {
    expect(isAlertDue("daily", hoursBefore(24), NOW)).toBe(true);
  });

  it("tolerates a cron that fires slightly early, rather than skipping a day", () => {
    // A cron pinned to 06:00 can fire at 05:58; a strict 24h test would then
    // defer the alert by a whole extra day.
    expect(isAlertDue("daily", hoursBefore(23), NOW)).toBe(true);
  });

  it("is not due for a weekly alert after two days", () => {
    expect(isAlertDue("weekly", hoursBefore(48), NOW)).toBe(false);
  });

  it("is due for a weekly alert after a week", () => {
    expect(isAlertDue("weekly", hoursBefore(24 * 7), NOW)).toBe(true);
  });

  it("treats an unparseable timestamp as never run rather than never due", () => {
    expect(isAlertDue("daily", "not-a-date", NOW)).toBe(true);
  });

  it("handles every frequency", () => {
    for (const frequency of ALERT_FREQUENCIES satisfies readonly AlertFrequency[]) {
      expect(typeof isAlertDue(frequency, null, NOW)).toBe("boolean");
    }
  });
});

function job(overrides: Partial<Job>): Job {
  return {
    id: "j1",
    slug: "a-job",
    companyId: "c1",
    company: { name: "Acme", slug: "acme", logoColor: "#111", logoPath: null },
    title: "Engineer",
    location: "Remote",
    type: "full-time",
    workMode: "remote",
    experience: "mid",
    salaryMin: 10,
    salaryMax: 20,
    currency: "USD",
    description: "d",
    responsibilities: [],
    requirements: [],
    perks: [],
    tags: [],
    status: "published",
    postedAt: hoursBefore(1),
    noExperienceRequired: false,
    visaSponsorship: false,
    language: "en",
    ...overrides,
  };
}

describe("jobsMatchingSince", () => {
  it("returns only jobs posted after the cutoff", () => {
    const fresh = job({ id: "fresh", postedAt: hoursBefore(1) });
    const stale = job({ id: "stale", postedAt: hoursBefore(100) });
    const result = jobsMatchingSince([fresh, stale], "", hoursBefore(10));
    expect(result.map((j) => j.id)).toEqual(["fresh"]);
  });

  it("returns every job when the alert has never run", () => {
    const result = jobsMatchingSince([job({ id: "a" }), job({ id: "b" })], "", null);
    expect(result).toHaveLength(2);
  });

  it("applies the saved search's filters", () => {
    const remote = job({ id: "remote", workMode: "remote" });
    const onsite = job({ id: "onsite", workMode: "on-site" });
    const result = jobsMatchingSince([remote, onsite], "mode=remote", null);
    expect(result.map((j) => j.id)).toEqual(["remote"]);
  });

  it("applies the saved search's text query", () => {
    const match = job({ id: "match", title: "Rust Engineer" });
    const other = job({ id: "other", title: "Designer" });
    const result = jobsMatchingSince([match, other], "q=rust", null);
    expect(result.map((j) => j.id)).toEqual(["match"]);
  });

  it("ignores a job posted exactly at the cutoff, so none is sent twice", () => {
    const cutoff = hoursBefore(5);
    const result = jobsMatchingSince([job({ id: "edge", postedAt: cutoff })], "", cutoff);
    expect(result).toEqual([]);
  });
});
