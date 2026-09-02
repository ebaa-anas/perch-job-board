import { z } from "zod";
import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  WORK_MODES,
} from "@/features/jobs/types";

const SALARY_CEILING = 10_000_000;

/* -------------------------------------------------------------------------- */
/*  Recruiter dashboard editor                                                 */
/* -------------------------------------------------------------------------- */

const optionalApplyUrl = z.union([
  z.literal(""),
  z.url("Enter a valid URL, including https://"),
]);

/**
 * Bound to the recruiter's job editor. No `company` field — the job is attached
 * to the recruiter's own company server-side. `applyUrl` is optional (blank =
 * on-site apply). Raw string fields for the list inputs, same as `jobFormSchema`.
 */
export const jobEditorSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
    location: z.string().trim().min(2, "Location is required").max(80),
    type: z.enum(JOB_TYPES, { error: "Choose a job type" }),
    workMode: z.enum(WORK_MODES, { error: "Choose a work mode" }),
    experience: z.enum(EXPERIENCE_LEVELS, { error: "Choose an experience level" }),
    salaryMin: z.number({ error: "Enter a number" }).min(0).max(SALARY_CEILING),
    salaryMax: z.number({ error: "Enter a number" }).min(0).max(SALARY_CEILING),
    description: z
      .string()
      .trim()
      .min(50, "Add at least 50 characters so candidates know what to expect")
      .max(5000),
    responsibilities: z.string().trim().min(3, "List at least one (one per line)"),
    requirements: z.string().trim().min(3, "List at least one (one per line)"),
    perks: z.string().trim(),
    tags: z.string().trim().min(1, "Add at least one skill tag"),
    applyUrl: optionalApplyUrl,
  })
  .refine((v) => v.salaryMax >= v.salaryMin, {
    path: ["salaryMax"],
    message: "Max salary must be greater than or equal to min salary",
  });

export type JobEditorValues = z.infer<typeof jobEditorSchema>;

/** Server-side contract for createJob / updateJob — list fields already split. */
export const jobEditorApiSchema = z
  .object({
    title: z.string().trim().min(3).max(100),
    location: z.string().trim().min(2).max(80),
    type: z.enum(JOB_TYPES),
    workMode: z.enum(WORK_MODES),
    experience: z.enum(EXPERIENCE_LEVELS),
    salaryMin: z.number().min(0).max(SALARY_CEILING),
    salaryMax: z.number().min(0).max(SALARY_CEILING),
    description: z.string().trim().min(50).max(5000),
    responsibilities: z.array(z.string().trim().min(1)).min(1).max(20),
    requirements: z.array(z.string().trim().min(1)).min(1).max(20),
    perks: z.array(z.string().trim().min(1)).max(20).default([]),
    tags: z.array(z.string().trim().min(1)).min(1).max(12),
    applyUrl: z.union([z.literal(""), z.url()]).optional(),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, {
    path: ["salaryMax"],
    message: "Max salary must be greater than or equal to min salary",
  });

export type JobEditorInput = z.infer<typeof jobEditorApiSchema>;

/** Split a textarea value into a trimmed, de-duped list. */
export function linesToList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter(Boolean),
    ),
  );
}

/** Split a comma / newline separated value into a trimmed, de-duped list. */
export function tokensToList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  );
}
