"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/features/team/actions";
import { TEAM_ROLE_DESCRIPTIONS, TEAM_ROLE_LABELS } from "@/features/team/roles";
import type { AssignableTeamRole } from "@/features/team/roles";

/**
 * Accepting is an explicit click, never a side effect of opening the link.
 *
 * Email clients and link scanners fetch URLs unprompted, so a GET that joined
 * a team would see invitations accepted by a spam filter.
 */
export function AcceptInvite({
  token,
  companyName,
  role,
}: {
  token: string;
  companyName: string;
  role: AssignableTeamRole;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    const result = await acceptInvite(token);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <h1 className="font-display text-3xl">Join {companyName}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        You have been invited to join {companyName} on Perch as a{" "}
        {TEAM_ROLE_LABELS[role].toLowerCase()}.{" "}
        {TEAM_ROLE_DESCRIPTIONS[role]}
      </p>
      <Button size="lg" className="mt-5" onClick={accept} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Accept invitation
      </Button>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
