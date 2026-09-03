import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getProfile, requireUser } from "@/features/auth/session";
import { AuthHeading } from "@/features/auth/components/auth-ui";
import { OnboardingChoice } from "@/features/auth/components/onboarding-choice";

export const metadata: Metadata = { title: "Choose how you'll use Perch", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const profile = await getProfile();
  if (profile?.role) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <AuthHeading
        title="One more step"
        subtitle="Tell us why you're here so we can set up the right workspace."
      />
      <OnboardingChoice />
    </div>
  );
}
