import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";

import { SEED_JOBS } from "@/features/jobs/seed";
import type { Job } from "@/features/jobs/types";
import type { JobCreateInput } from "@/features/jobs/schema";

/**
 * File-backed data layer. `data/jobs.json` at the project root is the source of
 * truth; it is seeded from `SEED_JOBS` on first access. All reads and writes go
 * through here so pages and route handlers never touch the filesystem directly.
 *
 * This module is server-only — importing it into a Client Component will fail
 * to bundle `node:fs`.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "jobs.json");

/** Serialize writes so two concurrent creates can't clobber the file. */
let writeChain: Promise<unknown> = Promise.resolve();

function queueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => {});
  return run;
}

async function readFromDisk(): Promise<Job[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Job[];
    if (!Array.isArray(parsed)) throw new Error("jobs.json is not an array");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(SEED_JOBS, null, 2), "utf8");
      return SEED_JOBS;
    }
    throw error;
  }
}

async function writeToDisk(jobs: Job[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(jobs, null, 2), "utf8");
}

/**
 * Read all jobs. Memoized for the lifetime of a single request via `React.cache`
 * so multiple components can call it without re-reading the file.
 */
export const getJobs = cache(async (): Promise<Job[]> => {
  const jobs = await readFromDisk();
  return [...jobs].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );
});

export const getJobById = cache(async (id: string): Promise<Job | null> => {
  const jobs = await readFromDisk();
  return jobs.find((job) => job.id === id) ?? null;
});

const DIACRITICS = /[̀-ͯ]/g;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildUniqueId(title: string, company: string, existing: Job[]): string {
  const base = `${slugify(title)}-${slugify(company)}`.replace(/^-+|-+$/g, "");
  const taken = new Set(existing.map((job) => job.id));
  if (base && !taken.has(base)) return base;
  let candidate = "";
  do {
    candidate = `${base || "job"}-${Math.random().toString(36).slice(2, 7)}`;
  } while (taken.has(candidate));
  return candidate;
}

const LOGO_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#3b82f6",
  "#22c55e",
];

function pickLogoColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
}

export async function createJob(input: JobCreateInput): Promise<Job> {
  return queueWrite(async () => {
    const jobs = await readFromDisk();
    const job: Job = {
      id: buildUniqueId(input.title, input.company, jobs),
      title: input.title,
      company: input.company,
      companyLogoColor: pickLogoColor(input.company),
      location: input.location,
      type: input.type,
      workMode: input.workMode,
      experience: input.experience,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      currency: "USD",
      description: input.description,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      perks: input.perks,
      tags: input.tags,
      applyUrl: input.applyUrl,
      postedAt: new Date().toISOString(),
    };
    await writeToDisk([job, ...jobs]);
    return job;
  });
}
