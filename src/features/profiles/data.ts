import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";

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
        "headline, location, bio, skills, portfolio_url, linkedin_url, github_url, cv_path, cv_filename",
      )
      .eq("profile_id", user.id)
      .maybeSingle();
    return data ? mapRow(data as Row) : null;
  },
);
