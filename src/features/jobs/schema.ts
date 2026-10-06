import { z } from "zod";
import {
  APPLICATION_QUESTION_TYPES,
  CONTENT_LANGUAGES,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  MAX_APPLICATION_QUESTIONS,
  WORK_MODES,
} from "@/features/jobs/types";

const SALARY_CEILING = 10_000_000;

/* -------------------------------------------------------------------------- */
/*  Per-job custom application questions                                       */
/* -------------------------------------------------------------------------- */

/** Authored by the recruiter in the job editor — one custom question. */
export const applicationQuestionSchema = z
  .object({
    label: z.string().trim().min(3, "Question needs at least 3 characters").max(200),
    type: z.enum(APPLICATION_QUESTION_TYPES, { error: "Choose a question type" }),
    required: z.boolean(),
    // No `.default([])` here: every caller (client form defaults, API payload
    // mapping) always supplies `options` explicitly. A default would make
    // zodResolver's input type diverge from `JobEditorValues` (the output
    // type `useForm` is typed with), which TypeScript rejects.
    options: z.array(z.string().trim().min(1)).max(6),
  })
  .refine((q) => q.type !== "multiple_choice" || q.options.length >= 2, {
    path: ["options"],
    message: "Add at least 2 options",
  });

export type ApplicationQuestionValues = z.infer<typeof applicationQuestionSchema>;

export const applicationQuestionsSchema = z
  .array(applicationQuestionSchema)
  .max(MAX_APPLICATION_QUESTIONS, `Up to ${MAX_APPLICATION_QUESTIONS} questions`);

/* -------------------------------------------------------------------------- */
/*  Recruiter dashboard editor                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Bound to the recruiter's job editor. No `company` field — the job is attached
 * to the recruiter's own company server-side. Every application is submitted
 * on Perch through `questions` (see above) — there is no external apply link.
 * Raw string fields for the list inputs, same as `jobFormSchema`.
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
    // Plain (non-default) booleans: react-hook-form always supplies both from
    // `defaultValues`, and a `.default()` here would make zodResolver's input
    // type diverge from `JobEditorValues` (the output type `useForm` is typed
    // with), which TypeScript rejects.
    noExperienceRequired: z.boolean(),
    visaSponsorship: z.boolean(),
    language: z.enum(CONTENT_LANGUAGES, { error: "Choose a language" }),
    questions: applicationQuestionsSchema,
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
    noExperienceRequired: z.boolean().default(false),
    visaSponsorship: z.boolean().default(false),
    language: z.enum(CONTENT_LANGUAGES).default("en"),
    questions: applicationQuestionsSchema.default([]),
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
