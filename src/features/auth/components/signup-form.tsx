"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Loader2, MailCheck, Search } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { signUp } from "@/features/auth/actions";
import {
  AUTH_ROLES,
  signUpSchema,
  type AuthRole,
  type SignUpValues,
} from "@/features/auth/schema";
import { Field, FormError, OrDivider } from "@/features/auth/components/auth-ui";
import { GoogleButton } from "@/features/auth/components/google-button";

const ROLE_COPY: Record<AuthRole, { label: string; hint: string; icon: typeof Search }> = {
  seeker: { label: "I'm looking for work", hint: "Browse, save and apply", icon: Search },
  recruiter: { label: "I'm hiring", hint: "Post jobs and review applicants", icon: Briefcase },
};

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const [role, setRole] = React.useState<AuthRole>("seeker");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", fullName: "", role: "seeker" },
    mode: "onBlur",
  });

  const pickRole = (value: AuthRole) => {
    setRole(value);
    setValue("role", value, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signUp(values);
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setSentTo(values.email);
      return;
    }
    // Confirmation disabled — the session is live. Land on the dashboard
    // (role was set from signup metadata by the handle_new_user trigger).
    router.push(next ?? "/dashboard");
    router.refresh();
  });

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <MailCheck className="size-6" />
        </div>
        <h2 className="font-display text-2xl">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to
          finish setting up your account.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">How will you use Perch?</legend>
        <div className="grid grid-cols-2 gap-2">
          {AUTH_ROLES.map((value) => {
            const copy = ROLE_COPY[value];
            const active = role === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pickRole(value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-accent"
                    : "border-border hover:border-foreground/20",
                )}
              >
                <copy.icon className="size-4 text-primary" />
                <span className="text-sm font-medium">{copy.label}</span>
                <span className="text-xs text-muted-foreground">{copy.hint}</span>
              </button>
            );
          })}
        </div>
        {errors.role?.message ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.role.message}
          </p>
        ) : null}
      </fieldset>

      <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          {...register("fullName")}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <OrDivider />
      <GoogleButton next={next} label="Sign up with Google" />

      <p className="pt-1 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
