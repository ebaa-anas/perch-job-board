import type { Metadata } from "next";

import { safeRelativePath } from "@/features/auth/redirect";
import { AuthHeading, AuthPanel } from "@/features/auth/components/auth-ui";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
  const safeNext =
    safeRelativePath(typeof next === "string" ? next : null) ?? undefined;

  return (
    <AuthPanel>
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in to manage your applications or job posts."
      />
      <LoginForm next={safeNext} />
    </AuthPanel>
  );
}
