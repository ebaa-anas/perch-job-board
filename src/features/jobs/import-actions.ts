"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/features/auth/session";
import { createJob } from "@/features/jobs/actions";
import { getOwnJob, getJobQuestions } from "@/features/jobs/data";
import { parseJobsCsv, type CsvRowError } from "@/features/jobs/csv-import";

/**
 * Bulk import and repost.
 *
 * Both reuse `createJob` rather than writing to `jobs` directly, so slug
 * collision handling, company resolution, the suspension check and the
 * question write all behave exactly as they do for a single post. An import
 * path that bypassed those would be a second, quietly diverging way to create
 * a job.
 */

export interface ImportReport {
  ok: true;
  /** Jobs created. */
  created: number;
  /** Rows the parser or the database refused, with line numbers. */
  errors: CsvRowError[];
  /** True when the file parsed but every row was rejected. */
  nothingImported: boolean;
}

/** 1 MB of CSV is far more than `MAX_IMPORT_ROWS` rows of text. */
const MAX_CSV_BYTES = 1_000_000;

export async function importJobsFromCsv(input: {
  csv: string;
  publish: boolean;
}): Promise<ImportReport | { ok: false; error: string }> {
  await requireRole("recruiter");

  const parsedInput = z
    .object({ csv: z.string().max(MAX_CSV_BYTES), publish: z.boolean() })
    .safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: "That file is too large to import." };
  }

  const { jobs, jobLines, errors } = parseJobsCsv(parsedInput.data.csv);
  const allErrors = [...errors];

  // Sequential on purpose: `createJob` picks a free slug by reading the
  // existing ones, so two rows with the same title running concurrently could
  // both choose the same suffix.
  let created = 0;
  for (const [index, job] of jobs.entries()) {
    const result = await createJob(job, { publish: parsedInput.data.publish });
    if (result.ok) {
      created += 1;
      continue;
    }
    // Reported against the actual spreadsheet line, which `jobLines` carries
    // alongside each accepted row.
    allErrors.push({
      line: jobLines[index] ?? index + 2,
      message: `${job.title}: ${result.error}`,
    });
  }

  revalidatePath("/dashboard");

  return {
    ok: true,
    created,
    errors: allErrors,
    nothingImported: created === 0,
  };
}

/**
 * Copy an existing job into a new draft.
 *
 * Always a draft, never published: a repost is usually edited first (dates,
 * salary, team), and silently publishing a duplicate would put two live
 * listings for the same role on the public board.
 */
export async function duplicateJob(
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireRole("recruiter");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid input." };
  }

  // `getOwnJob` is scoped to the caller's company, so this doubles as the
  // ownership check; RLS refuses the insert regardless.
  const job = await getOwnJob(id);
  if (!job) return { ok: false, error: "Job not found." };

  const questions = await getJobQuestions(job.id);

  const result = await createJob(
    {
      title: `${job.title} (copy)`,
      location: job.location,
      type: job.type,
      workMode: job.workMode,
      experience: job.experience,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      perks: job.perks,
      tags: job.tags,
      noExperienceRequired: job.noExperienceRequired,
      visaSponsorship: job.visaSponsorship,
      language: job.language,
      questions: questions.map((question) => ({
        label: question.label,
        type: question.type,
        required: question.required,
        options: question.options,
        knockoutAnswer: question.knockoutAnswer ?? "",
      })),
    },
    { publish: false },
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  return { ok: true, id: result.data.id };
}
