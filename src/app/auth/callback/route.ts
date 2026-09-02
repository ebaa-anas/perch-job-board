import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/features/auth/redirect";
import { destForRole, maybeUpgradeAdmin } from "@/features/auth/actions";

/**
 * OAuth + email-confirmation landing. Supabase sends either a PKCE `?code=` (both
 * Google and the newer email links) or a legacy `?token_hash=&type=`. We exchange
 * it for a session, run the admin-email upgrade, and forward to `next` (local
 * paths only) or the role-appropriate destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRelativePath(searchParams.get("next"));

  const supabase = await createClient();

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  await maybeUpgradeAdmin();

  const dest = next ?? (await destForRole());
  return NextResponse.redirect(`${origin}${dest}`);
}
