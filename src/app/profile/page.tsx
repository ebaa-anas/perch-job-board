import type { Metadata } from "next";

import { getProfile } from "@/features/auth/session";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { SeekerProfileForm } from "@/features/profiles/components/seeker-profile-form";
import { CvUpload } from "@/features/profiles/components/cv-upload";
import { getOwnSkillGaps } from "@/features/matching/data";
import { SkillGapsCard } from "@/features/matching/components/skill-gaps-card";
import { PrivacyControls } from "@/features/privacy/components/privacy-controls";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const [profile, seeker, skillGaps] = await Promise.all([
    getProfile(),
    getOwnSeekerProfile(),
    getOwnSkillGaps(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-4xl">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          Signed in as {profile?.email}. This information is shown to recruiters
          when you apply.
        </p>
      </header>

      <div className="space-y-8">
        <SkillGapsCard gaps={skillGaps.gaps} jobCount={skillGaps.jobCount} />
        <CvUpload
          uid={profile?.id ?? ""}
          currentFilename={seeker?.cvFilename ?? null}
          hasCv={Boolean(seeker?.cvPath)}
        />
        <SeekerProfileForm
          initial={{
            headline: seeker?.headline ?? "",
            location: seeker?.location ?? "",
            bio: seeker?.bio ?? "",
            skills: (seeker?.skills ?? []).join(", "),
            portfolioUrl: seeker?.portfolioUrl ?? "",
            linkedinUrl: seeker?.linkedinUrl ?? "",
            githubUrl: seeker?.githubUrl ?? "",
          }}
        />
        <PrivacyControls />
      </div>
    </div>
  );
}
