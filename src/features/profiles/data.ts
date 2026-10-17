import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import type { ExperienceLevel, JobType, WorkMode } from "@/features/jobs/types";
import type { WorkAuthorization } from "@/features/profiles/schema";

export interface SeekerProfile {
  headline: string | null;
  location: string | null;
  bio: string | null;
  skills: string[];
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  cvPath: string | null;
  cvFilename: string | null;

  /* Matching fields (0022). `null` means not answered, and stays distinct
     from `false` everywhere downstream. */
  experience: ExperienceLevel | null;
  noProfessionalExperience: boolean | null;
  needsVisaSponsorship: boolean | null;
  workAuthorization: WorkAuthorization | null;
  desiredTypes: JobType[];
  desiredWorkModes: WorkMode[];
  desiredLocations: string[];
}

type Row = {
  headline: string | null;
  location: string | null;
  bio: string | null;
  skills: string[] | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  cv_path: string | null;
  cv_filename: string | null;
  experience: string | null;
  no_professional_experience: boolean | null;
  needs_visa_sponsorship: boolean | null;
  work_authorization: string | null;
  desired_types: string[] | null;
  desired_work_modes: string[] | null;
  desired_locations: string[] | null;
};

function mapRow(row: Row): SeekerProfile {
  return {
    headline: row.headline,
    location: row.location,
    bio: row.bio,
    skills: row.skills ?? [],
    portfolioUrl: row.portfolio_url,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    cvPath: row.cv_path,
    cvFilename: row.cv_filename,
    experience: (row.experience as ExperienceLevel | null) ?? null,
    noProfessionalExperience: row.no_professional_experience,
    needsVisaSponsorship: row.needs_visa_sponsorship,
    workAuthorization: (row.work_authorization as WorkAuthorization | null) ?? null,
    desiredTypes: (row.desired_types as JobType[] | null) ?? [],
    desiredWorkModes: (row.desired_work_modes as WorkMode[] | null) ?? [],
    desiredLocations: row.desired_locations ?? [],
  };
}

/** The signed-in seeker's profile row, or null if they haven't saved one yet. */
export const getOwnSeekerProfile = cache(
  async (): Promise<SeekerProfile | null> => {
    const user = await getUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("seeker_profiles")
      .select(
        "headline, location, bio, skills, portfolio_url, linkedin_url, github_url, cv_path, cv_filename, experience, no_professional_experience, needs_visa_sponsorship, work_authorization, desired_types, desired_work_modes, desired_locations",
      )
      .eq("profile_id", user.id)
      .maybeSingle();
    return data ? mapRow(data as Row) : null;
  },
);
