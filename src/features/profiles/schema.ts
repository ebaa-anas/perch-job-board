import { z } from "zod";

import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  WORK_MODES,
} from "@/features/jobs/types";

/**
 * Work authorisation.
 *
 * Kept separate from `needsVisaSponsorship` because the two are
 * independent: someone on a student permit may still need sponsorship for a
 * full-time role, and collapsing both into one enum would force a false
 * answer on exactly the people the board exists for.
 */
export const WORK_AUTHORIZATIONS = ["citizen", "permit", "student", "none"] as const;
export type WorkAuthorization = (typeof WORK_AUTHORIZATIONS)[number];

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

  /*
   * Matching fields (0022). Every one is nullable and every one defaults to
   * "not said", which must stay distinguishable from "said no" — a seeker who
   * has not answered is never filtered out as though they had, and the match
   * score never charges them for a blank.
   *
   * The enums are the job-side constants, not copies: the whole point is that
   * the two sides are directly comparable.
   */
  experience: z.enum(EXPERIENCE_LEVELS).nullable().optional(),
  noProfessionalExperience: z.boolean().nullable().optional(),
  needsVisaSponsorship: z.boolean().nullable().optional(),
  workAuthorization: z.enum(WORK_AUTHORIZATIONS).nullable().optional(),

  /* Empty array means "no preference", which matches everything — the same
     semantics the job filters already use. */
  desiredTypes: z.array(z.enum(JOB_TYPES)).max(4).default([]),
  desiredWorkModes: z.array(z.enum(WORK_MODES)).max(3).default([]),
  desiredLocations: z
    .array(z.string().trim().min(1).max(80))
    .max(5, "Up to five locations")
    .default([]),
});

export type SeekerProfileValues = z.infer<typeof seekerProfileSchema>;

/**
 * What a caller supplies, before the schema fills in defaults.
 *
 * `upsertSeekerProfile` validates untrusted input, so its parameter is
 * this rather than the parsed output — declaring the post-parse type and
 * then parsing again forced every caller to pre-supply defaults the schema
 * exists to apply.
 */
export type SeekerProfileInput = z.input<typeof seekerProfileSchema>;

/** The shape the client form works with (list fields as raw comma strings). */
export type SeekerProfileFormValues = Omit<
  SeekerProfileValues,
  "skills" | "desiredLocations"
> & {
  skills: string;
  desiredLocations: string;
};

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
