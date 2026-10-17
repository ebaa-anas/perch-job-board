"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Building2, Loader2, Search, type LucideIcon } from "lucide-react";

import { demoSignInAction } from "@/features/demo/actions";
import type { DemoRole } from "@/features/demo/demo-rules";
import { FormError } from "@/features/auth/components/auth-ui";
import { useLocale } from "@/lib/i18n/locale-provider";

/**
 * "Try the demo" block on the sign-in page. Rendered only when demo mode is on
 * (the page decides); the action re-checks, so hiding it is not the guard.
 */
export function DemoSignIn() {
  const { t } = useLocale();
  const [state, formAction] = React.useActionState(demoSignInAction, null);

  return (
    <section
      aria-labelledby="demo-heading"
      className="mb-6 rounded-xl border border-primary/20 bg-accent/50 p-4"
    >
      <h2 id="demo-heading" className="text-sm font-semibold text-accent-foreground">
        {t.demo.tryTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.demo.trySubtitle}</p>

      <form action={formAction} className="mt-3 grid gap-2">
        <DemoRoleButton
          role="seeker"
          icon={Search}
          label={t.demo.exploreSeeker}
          hint={t.demo.exploreSeekerHint}
          pendingLabel={t.demo.opening}
        />
        <DemoRoleButton
          role="recruiter"
          icon={Building2}
          label={t.demo.exploreRecruiter}
          hint={t.demo.exploreRecruiterHint}
          pendingLabel={t.demo.opening}
        />
      </form>

      {state?.error ? (
        <div className="mt-3">
          <FormError message={state.error} />
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t.demo.orSignIn}
        <span className="h-px flex-1 bg-border" />
      </div>
    </section>
  );
}

function DemoRoleButton({
  role,
  icon: Icon,
  label,
  hint,
  pendingLabel,
}: {
  role: DemoRole;
  icon: LucideIcon;
  label: string;
  hint: string;
  pendingLabel: string;
}) {
  // `data` is the submitted FormData, so each button can tell whether it was
  // the one pressed rather than both spinning at once.
  const { pending, data } = useFormStatus();
  const isMine = pending && data?.get("role") === role;

  return (
    <button
      type="submit"
      name="role"
      value={role}
      disabled={pending}
      className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        {isMine ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{isMine ? pendingLabel : label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
