"use client";

import * as React from "react";
import { Download, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMyAccount, exportMyData } from "@/features/privacy/actions";

/**
 * Subject-access and erasure controls.
 *
 * Deliberately plain and unpersuasive: there is no retention copy, no "are you
 * sure you want to lose everything", no pre-ticked boxes. A right that is made
 * awkward to exercise is not really granted.
 */
export function PrivacyControls() {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-xl">Your data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You can take a copy of everything we hold about you, or delete your
        account outright.
      </p>
      <div className="mt-4 space-y-6">
        <ExportButton />
        <DeleteAccount />
      </div>
    </section>
  );
}

function ExportButton() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    const result = await exportMyData();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `perch-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Button variant="outline" onClick={download} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Download my data
      </Button>
      <p className="mt-1.5 text-xs text-muted-foreground">
        A JSON file: your profile, applications, saved jobs and searches,
        alerts, notifications and reviews.
      </p>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    // On success this redirects and never returns.
    const result = await deleteMyAccount(confirmation);
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  };

  if (!open) {
    return (
      <div className="border-t border-border pt-5">
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          className="text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          Delete my account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-5">
      <p className="flex items-start gap-2 text-sm">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
          aria-hidden
        />
        <span>
          This deletes your account, your profile, your CV file, and every
          application, saved job, alert and review attached to it. It cannot be
          undone.
        </span>
      </p>
      <label htmlFor="delete-confirm" className="block text-sm">
        Type <span className="font-mono font-medium">delete</span> to confirm
      </label>
      <Input
        id="delete-confirm"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        disabled={busy}
        autoComplete="off"
        className="max-w-xs"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          onClick={submit}
          disabled={busy || confirmation.trim().toLowerCase() !== "delete"}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Delete permanently
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
