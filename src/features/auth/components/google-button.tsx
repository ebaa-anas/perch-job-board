"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/features/auth/actions";

/**
 * "Continue with Google". Degrades gracefully: if the provider isn't provisioned
 * the action returns `{ error }` and we show it inline instead of navigating.
 */
export function GoogleButton({
  next,
  label = "Continue with Google",
  onUnavailable,
}: {
  next?: string;
  label?: string;
  onUnavailable?: (message: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          const result = await signInWithGoogle(next);
          if ("url" in result) {
            window.location.href = result.url;
            return;
          }
          setBusy(false);
          setNote(result.error);
          onUnavailable?.(result.error);
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        {label}
      </Button>
      {note ? (
        <p className="text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.88h3.72c2.18-2 3.44-4.96 3.44-8.37Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.88c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.97A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.71a7.2 7.2 0 0 1 0-4.42V7.32H1.76a12 12 0 0 0 0 10.36l3.84-2.97Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.7 1.2 15.1 0 12 0A11.99 11.99 0 0 0 1.76 7.32l3.84 2.97C6.5 6.76 9.02 4.75 12 4.75Z"
      />
    </svg>
  );
}
