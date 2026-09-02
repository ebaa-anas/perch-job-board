"use client";

import * as React from "react";
import { ArrowRight, Briefcase, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/features/auth/actions";
import { AUTH_ROLES, type AuthRole } from "@/features/auth/schema";
import { FormError } from "@/features/auth/components/auth-ui";

const CARDS: Record<
  AuthRole,
  { title: string; body: string; icon: typeof Search }
> = {
  seeker: {
    title: "Find work",
    body: "Build a profile, save roles, and apply in a couple of clicks.",
    icon: Search,
  },
  recruiter: {
    title: "Hire",
    body: "Set up your company, post openings, and review applicants in one place.",
    icon: Briefcase,
  },
};

export function OnboardingChoice() {
  const [pending, setPending] = React.useState<AuthRole | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const choose = async (role: AuthRole) => {
    setError(null);
    setPending(role);
    const result = await completeOnboarding(role);
    // Success redirects from the server; only an error returns here.
    if (result?.error) {
      setError(result.error);
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {AUTH_ROLES.map((role) => {
          const card = CARDS[role];
          const busy = pending === role;
          return (
            <button
              key={role}
              type="button"
              disabled={pending !== null}
              onClick={() => choose(role)}
              className={cn(
                "group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors",
                "hover:border-primary hover:bg-accent disabled:opacity-60",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <card.icon className="size-5" />
                )}
              </span>
              <span className="font-display text-xl">{card.title}</span>
              <span className="text-sm text-muted-foreground">{card.body}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Continue
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        This can&apos;t be changed later — pick the one that fits.
      </p>
    </div>
  );
}
