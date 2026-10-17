"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/features/auth/components/auth-ui";
import { upsertSeekerProfile } from "@/features/profiles/actions";
import { Select } from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
} from "@/features/jobs/types";
import { WORK_AUTHORIZATIONS } from "@/features/profiles/schema";
import { SkillHints } from "@/features/profiles/components/skill-hints";
import type { SkillSuggestion } from "@/features/profiles/skill-suggestions";

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

  /* Matching fields. "" is the form's representation of "not answered", and
     is converted back to null on submit — never to false. */
  experience: z.string(),
  noProfessionalExperience: z.boolean(),
  needsVisaSponsorship: z.string(),
  workAuthorization: z.string(),
  desiredTypes: z.array(z.string()),
  desiredWorkModes: z.array(z.string()),
  desiredLocations: z.string().max(300),
});
type FormValues = z.infer<typeof formSchema>;

function splitList(raw: string, limit: number): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

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
  skillCorpus,
}: {
  initial: FormValues;
  /** Ranked tags from the live board, for the skills hints. */
  skillCorpus: SkillSuggestion[];
}) {
  const { t } = useLocale();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: "onBlur",
  });

  /* `useWatch`, not `watch()`: the subscription form is what the React
     Compiler can reason about, and it is the pattern the job editor
     already uses. */
  const skillsValue = useWatch({ control, name: "skills" }) ?? "";

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
      // "" means the seeker did not answer. It must become null, never false:
      // the match score and the completeness meter both depend on being able
      // to tell "not said" from "said no".
      experience: values.experience
        ? (values.experience as (typeof EXPERIENCE_LEVELS)[number])
        : null,
      noProfessionalExperience: values.noProfessionalExperience,
      needsVisaSponsorship:
        values.needsVisaSponsorship === ""
          ? null
          : values.needsVisaSponsorship === "yes",
      workAuthorization: values.workAuthorization
        ? (values.workAuthorization as (typeof WORK_AUTHORIZATIONS)[number])
        : null,
      desiredTypes: values.desiredTypes as (typeof JOB_TYPES)[number][],
      desiredWorkModes: values.desiredWorkModes as (typeof WORK_MODES)[number][],
      desiredLocations: splitList(values.desiredLocations, 5),
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
        <SkillHints
          raw={skillsValue}
          corpus={skillCorpus}
          onPick={(skill) => {
            const current = skillsValue.trim();
            setValue("skills", current ? `${current}, ${skill}` : skill, {
              shouldDirty: true,
            });
          }}
        />
      </Field>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="text-sm font-semibold">{t.profile.matching}</legend>
          <p className="text-xs text-muted-foreground">{t.profile.matchingHint}</p>

          <Field label={t.profile.experience} htmlFor="experience">
            <Select id="experience" {...register("experience")}>
              <option value="">{t.profile.experiencePlaceholder}</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EXPERIENCE_LABELS[level]}
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input accent-primary"
              {...register("noProfessionalExperience")}
            />
            {t.profile.experienceNone}
          </label>

          <Field label={t.profile.workAuthorization} htmlFor="workAuthorization">
            <Select id="workAuthorization" {...register("workAuthorization")}>
              <option value="">{t.profile.workAuthPlaceholder}</option>
              {WORK_AUTHORIZATIONS.map((value) => (
                <option key={value} value={value}>
                  {t.profile.workAuth[value]}
                </option>
              ))}
            </Select>
          </Field>

          {/* Three states, not a checkbox: "" keeps "not answered" distinct
              from an explicit no. */}
          <Field label={t.profile.needsSponsorship} htmlFor="needsVisaSponsorship">
            <Select id="needsVisaSponsorship" {...register("needsVisaSponsorship")}>
              <option value="">{t.profile.workAuthPlaceholder}</option>
              <option value="yes">{t.common.yes}</option>
              <option value="no">{t.common.no}</option>
            </Select>
          </Field>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="text-sm font-semibold">{t.profile.preferences}</legend>

          <div>
            <span className="text-sm font-medium">{t.profile.desiredTypes}</span>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {JOB_TYPES.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={value}
                    className="size-4 rounded border-input accent-primary"
                    {...register("desiredTypes")}
                  />
                  {JOB_TYPE_LABELS[value]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">{t.profile.desiredWorkModes}</span>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {WORK_MODES.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={value}
                    className="size-4 rounded border-input accent-primary"
                    {...register("desiredWorkModes")}
                  />
                  {WORK_MODE_LABELS[value]}
                </label>
              ))}
            </div>
          </div>

          <Field
            label={t.profile.desiredLocations}
            htmlFor="desiredLocations"
            hint={t.profile.desiredLocationsHint}
          >
            <Input
              id="desiredLocations"
              placeholder="Istanbul, Remote"
              {...register("desiredLocations")}
            />
          </Field>
        </fieldset>

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
