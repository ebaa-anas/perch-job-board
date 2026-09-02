import type { Metadata } from "next";

import { safeRelativePath } from "@/features/auth/redirect";
import { AuthHeading, AuthPanel } from "@/features/auth/components/auth-ui";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { next } = await searchParams;
  const safeNext =
    safeRelativePath(typeof next === "string" ? next : null) ?? undefined;

  return (
    <AuthPanel>
      <AuthHeading
        title="Join Perch"
        subtitle="One account. Pick the side you're on — you can't switch later."
      />
      <SignupForm next={safeNext} />
    </AuthPanel>
  );
}
