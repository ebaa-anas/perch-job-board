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
