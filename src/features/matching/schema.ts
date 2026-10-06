import { z } from "zod";

/** The model's response, validated before it's cached or shown to a seeker. */
export const fitAssessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(200),
  strengths: z.array(z.string().trim().min(1)).max(4).default([]),
  gaps: z.array(z.string().trim().min(1)).max(4).default([]),
});

export type FitAssessment = z.infer<typeof fitAssessmentSchema>;
