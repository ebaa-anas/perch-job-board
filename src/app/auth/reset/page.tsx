import type { Metadata } from "next";

import { getUser } from "@/features/auth/session";
import { AuthHeading, AuthPanel } from "@/features/auth/components/auth-ui";
import {
  NewPasswordForm,
  RequestResetForm,
} from "@/features/auth/components/reset-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPage() {
  // Arriving from the reset email, /auth/callback has already exchanged the code
  // for a recovery session, so there is a user here. Otherwise this is someone
  // who navigated in cold and needs to request a link.
  const user = await getUser();

  return (
    <AuthPanel>
      {user ? (
        <>
          <AuthHeading
            title="Set a new password"
            subtitle="Choose a new password for your account."
          />
          <NewPasswordForm />
        </>
      ) : (
        <>
          <AuthHeading
            title="Reset your password"
            subtitle="We'll email you a link to choose a new one."
          />
          <RequestResetForm />
        </>
      )}
    </AuthPanel>
  );
}
