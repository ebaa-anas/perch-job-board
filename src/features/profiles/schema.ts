import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL")]);

export const seekerProfileSchema = z.object({
  headline: z.string().trim().max(120, "Keep the headline under 120 characters").optional(),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000, "Keep the bio under 2000 characters").optional(),
  /** Free-text comma field in the form; split to string[] before the action. */
  skills: z.array(z.string().trim().min(1)).max(40, "That's a lot of skills — trim the list").default([]),
  portfolioUrl: optionalUrl.optional(),
  linkedinUrl: optionalUrl.optional(),
  githubUrl: optionalUrl.optional(),
});

export type SeekerProfileValues = z.infer<typeof seekerProfileSchema>;

/** The shape the client form works with (skills as a raw comma string). */
export type SeekerProfileFormValues = Omit<SeekerProfileValues, "skills"> & {
  skills: string;
};

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
