"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminDeleteUser } from "@/features/admin/actions";

export function UserDeleteButton({
  userId,
  email,
  redirectTo,
}: {
  userId: string;
  email: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <div className="text-right">
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              `Delete ${email}? This removes their account and everything they own.`,
            )
          )
            return;
          setBusy(true);
          setErr(null);
          const r = await adminDeleteUser(userId);
          setBusy(false);
          if (!r.ok) {
            setErr(r.error ?? "Failed.");
            return;
          }
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Delete
      </Button>
      {err && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
