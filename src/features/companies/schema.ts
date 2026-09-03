import { z } from "zod";

/** Optional URL field that also accepts an empty string (unset). */
const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL")]);

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
  tagline: z.string().trim().max(120, "Keep the tagline under 120 characters").optional(),
  description: z
    .string()
    .trim()
    .max(4000, "Keep the description under 4000 characters")
    .optional(),
  website: optionalUrl.optional(),
});

export type CompanyValues = z.infer<typeof companySchema>;

export const REPORT_REASONS = [
  "spam",
  "misleading",
  "inappropriate",
  "scam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam / posting junk",
  misleading: "Misleading job posts",
  inappropriate: "Inappropriate content",
  scam: "Looks like a scam",
  other: "Something else",
};

export const reportCompanySchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Pick a reason" }),
  detail: z.string().trim().max(1000, "Keep it under 1000 characters").optional(),
});
export type ReportCompanyValues = z.infer<typeof reportCompanySchema>;

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Pick a rating").max(5),
  title: z.string().trim().max(120, "Keep the title under 120 characters").optional(),
  body: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
});
export type ReviewValues = z.infer<typeof reviewSchema>;
