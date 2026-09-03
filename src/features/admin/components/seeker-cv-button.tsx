"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminSeekerCvUrl } from "@/features/admin/actions";

export function SeekerCvButton({
  userId,
  filename,
}: {
  userId: string;
  filename: string | null;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await adminSeekerCvUrl(userId);
          setBusy(false);
          if (!r.ok) {
            setErr(r.error);
            return;
          }
          window.open(r.url, "_blank", "noopener,noreferrer");
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {filename || "Download CV"}
      </Button>
      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
