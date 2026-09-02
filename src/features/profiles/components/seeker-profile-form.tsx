"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/features/auth/components/auth-ui";
import { upsertSeekerProfile } from "@/features/profiles/actions";

const optionalUrl = z.union([z.literal(""), z.url("Enter a valid URL")]);

/** Form-level schema: every field is a string (RHF controlled inputs); `skills`
 *  is a raw comma string here and split to string[] on submit. */
const formSchema = z.object({
  headline: z.string().trim().max(120, "Under 120 characters"),
  location: z.string().trim().max(120),
  bio: z.string().trim().max(2000, "Under 2000 characters"),
  skills: z.string().max(600),
  portfolioUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
});
type FormValues = z.infer<typeof formSchema>;

function splitSkills(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, 40);
}

export function SeekerProfileForm({
  initial,
}: {
  initial: FormValues;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await upsertSeekerProfile({
      headline: values.headline,
      location: values.location,
      bio: values.bio,
      skills: splitSkills(values.skills),
      portfolioUrl: values.portfolioUrl,
      linkedinUrl: values.linkedinUrl,
      githubUrl: values.githubUrl,
    });
    if (!result.ok) {
      setFormError(result.error);
      for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(key as keyof FormValues, { message });
      }
      return;
    }
    setSaved(true);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      noValidate
    >
      <div>
        <h2 className="text-sm font-semibold">About you</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A short headline and bio go a long way.
        </p>
      </div>

      <FormError message={formError} />

      <Field label="Headline" htmlFor="headline" error={errors.headline?.message}>
        <Input
          id="headline"
          placeholder="Senior frontend engineer — React, TypeScript"
          aria-invalid={!!errors.headline}
          {...register("headline")}
        />
      </Field>

      <Field label="Location" htmlFor="location" error={errors.location?.message}>
        <Input
          id="location"
          placeholder="Berlin, Germany (or Remote)"
          aria-invalid={!!errors.location}
          {...register("location")}
        />
      </Field>

      <Field
        label="Bio"
        htmlFor="bio"
        error={errors.bio?.message}
        hint="What you do, what you're looking for."
      >
        <Textarea
          id="bio"
          rows={5}
          aria-invalid={!!errors.bio}
          {...register("bio")}
        />
      </Field>

      <Field
        label="Skills"
        htmlFor="skills"
        error={errors.skills?.message}
        hint="Comma separated, e.g. React, TypeScript, GraphQL."
      >
        <Input
          id="skills"
          placeholder="React, TypeScript, Node.js"
          aria-invalid={!!errors.skills}
          {...register("skills")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Portfolio"
          htmlFor="portfolioUrl"
          error={errors.portfolioUrl?.message}
        >
          <Input
            id="portfolioUrl"
            type="url"
            placeholder="https://"
            aria-invalid={!!errors.portfolioUrl}
            {...register("portfolioUrl")}
          />
        </Field>
        <Field
          label="LinkedIn"
          htmlFor="linkedinUrl"
          error={errors.linkedinUrl?.message}
        >
          <Input
            id="linkedinUrl"
            type="url"
            placeholder="https://"
            aria-invalid={!!errors.linkedinUrl}
            {...register("linkedinUrl")}
          />
        </Field>
        <Field
          label="GitHub"
          htmlFor="githubUrl"
          error={errors.githubUrl?.message}
        >
          <Input
            id="githubUrl"
            type="url"
            placeholder="https://"
            aria-invalid={!!errors.githubUrl}
            {...register("githubUrl")}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
        {saved && !isDirty && (
          <span className="inline-flex items-center gap-1 text-sm text-primary">
            <Check className="size-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
