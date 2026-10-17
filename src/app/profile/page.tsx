import type { Metadata } from "next";

import { getProfile } from "@/features/auth/session";
import { getOwnSeekerProfile } from "@/features/profiles/data";
import { SeekerProfileForm } from "@/features/profiles/components/seeker-profile-form";
import { CvUpload } from "@/features/profiles/components/cv-upload";
import { getOwnSkillGaps } from "@/features/matching/data";
import { SkillGapsCard } from "@/features/matching/components/skill-gaps-card";
import { PrivacyControls } from "@/features/privacy/components/privacy-controls";
import { getJobs } from "@/features/jobs/data";
import { buildSkillCorpus } from "@/features/profiles/skill-suggestions";
import { computeCompleteness } from "@/features/profiles/completeness";
import { CompletenessMeter } from "@/features/profiles/components/completeness-meter";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const [profile, seeker, skillGaps, jobs] = await Promise.all([
    getProfile(),
    getOwnSeekerProfile(),
    getOwnSkillGaps(),
    getJobs(),
  ]);

  // Suggestions come from the live board, so the vocabulary a seeker is
  // nudged toward is exactly the one recruiters are tagging jobs with.
  const skillCorpus = buildSkillCorpus(jobs);

  const completeness = computeCompleteness({
    headline: seeker?.headline ?? null,
    bio: seeker?.bio ?? null,
    skills: seeker?.skills ?? [],
    hasCv: Boolean(seeker?.cvPath),
    experience: seeker?.experience ?? null,
    noProfessionalExperience: seeker?.noProfessionalExperience ?? null,
    needsVisaSponsorship: seeker?.needsVisaSponsorship ?? null,
    desiredTypes: seeker?.desiredTypes ?? [],
    desiredWorkModes: seeker?.desiredWorkModes ?? [],
  });

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
        <CompletenessMeter completeness={completeness} />
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
            // "" is the form's "not answered"; it maps back to null on save.
            experience: seeker?.experience ?? "",
            noProfessionalExperience: seeker?.noProfessionalExperience ?? false,
            needsVisaSponsorship:
              seeker?.needsVisaSponsorship === null ||
              seeker?.needsVisaSponsorship === undefined
                ? ""
                : seeker.needsVisaSponsorship
                  ? "yes"
                  : "no",
            workAuthorization: seeker?.workAuthorization ?? "",
            desiredTypes: seeker?.desiredTypes ?? [],
            desiredWorkModes: seeker?.desiredWorkModes ?? [],
            desiredLocations: (seeker?.desiredLocations ?? []).join(", "),
          }}
          skillCorpus={skillCorpus}
        />
        <PrivacyControls />
      </div>
    </div>
  );
}
