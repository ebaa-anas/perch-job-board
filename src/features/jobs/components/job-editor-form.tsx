"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { InclusiveLanguageHints } from "@/features/jobs/components/inclusive-language-hints";
import {
  CONTENT_LANGUAGES,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  LANGUAGE_LABELS,
  MAX_APPLICATION_QUESTIONS,
  QUESTION_TYPE_LABELS,
  APPLICATION_QUESTION_TYPES,
  WORK_MODES,
  WORK_MODE_LABELS,
} from "@/features/jobs/types";
import {
  jobEditorSchema,
  linesToList,
  tokensToList,
  type ApplicationQuestionValues,
  type JobEditorValues,
} from "@/features/jobs/schema";
import { createJob, updateJob } from "@/features/jobs/actions";
import { Field, FormError } from "@/features/auth/components/auth-ui";

const BLANK: JobEditorValues = {
  title: "",
  location: "",
  type: "full-time",
  workMode: "remote",
  experience: "mid",
  salaryMin: 60000,
  salaryMax: 90000,
  description: "",
  responsibilities: "",
  requirements: "",
  perks: "",
  tags: "",
  noExperienceRequired: false,
  visaSponsorship: false,
  language: "en",
  questions: [],
};

const BLANK_QUESTION: ApplicationQuestionValues = {
  label: "",
  type: "short_text",
  required: true,
  options: [],
  knockoutAnswer: "",
};

/**
 * Lints all four prose fields together, so a phrase in the requirements is
 * caught as readily as one in the description.
 */
function WordingHints({ control }: { control: Control<JobEditorValues> }) {
  const parts = useWatch({
    control,
    name: ["description", "responsibilities", "requirements", "perks"],
  });
  return <InclusiveLanguageHints text={(parts ?? []).filter(Boolean).join("\n")} />;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-sm md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function JobEditorForm({
  mode,
  jobId,
  initial,
}: {
  mode: "new" | "edit";
  jobId?: string;
  initial?: JobEditorValues;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [intent, setIntent] = React.useState<"draft" | "publish" | "save">(
    mode === "edit" ? "save" : "publish",
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobEditorValues>({
    resolver: zodResolver(jobEditorSchema),
    defaultValues: initial ?? BLANK,
    mode: "onBlur",
  });

  const questionArray = useFieldArray({ control, name: "questions" });

  const submit = (which: "draft" | "publish" | "save") =>
    handleSubmit(async (values) => {
      setFormError(null);
      setIntent(which);
      const payload = {
        title: values.title,
        location: values.location,
        type: values.type,
        workMode: values.workMode,
        experience: values.experience,
        salaryMin: values.salaryMin,
        salaryMax: values.salaryMax,
        description: values.description,
        responsibilities: linesToList(values.responsibilities),
        requirements: linesToList(values.requirements),
        perks: values.perks ? linesToList(values.perks) : [],
        tags: tokensToList(values.tags),
        noExperienceRequired: values.noExperienceRequired,
        visaSponsorship: values.visaSponsorship,
        language: values.language,
        questions: values.questions.map((q) => ({
          label: q.label,
          type: q.type,
          required: q.required,
          options: q.type === "multiple_choice" ? q.options : [],
          // A gate only means something for yes/no and multiple choice; drop
          // it if the recruiter changed the type after setting one, so the
          // saved question matches what the form now shows.
          knockoutAnswer:
            q.type === "yes_no" || q.type === "multiple_choice"
              ? q.knockoutAnswer
              : "",
        })),
      };

      const result =
        mode === "edit" && jobId
          ? await updateJob(jobId, payload)
          : await createJob(payload, { publish: which === "publish" });

      if (!result.ok) {
        setFormError(result.error);
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(key as keyof JobEditorValues, { message });
        }
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });

  const busy = isSubmitting;

  return (
    <form className="space-y-5" noValidate>
      <FormError message={formError} />

      <Section title="The role" description="The headline details candidates see first.">
        <Field label="Job title" htmlFor="title" error={errors.title?.message}>
          <Input
            id="title"
            placeholder="Senior Frontend Engineer"
            aria-invalid={!!errors.title}
            {...register("title")}
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
          label="Language"
          htmlFor="language"
          error={errors.language?.message}
          hint="Write the whole listing in this language."
        >
          <Select id="language" {...register("language")}>
            {CONTENT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Details" description="Employment type, ways of working, and pay.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Job type" htmlFor="type" error={errors.type?.message}>
            <Select id="type" {...register("type")}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Work mode" htmlFor="workMode" error={errors.workMode?.message}>
            <Select id="workMode" {...register("workMode")}>
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Experience" htmlFor="experience" error={errors.experience?.message}>
            <Select id="experience" {...register("experience")}>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {EXPERIENCE_LABELS[l]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Salary min (per year)" htmlFor="salaryMin" error={errors.salaryMin?.message}>
            <Input
              id="salaryMin"
              type="number"
              min={0}
              step={1000}
              aria-invalid={!!errors.salaryMin}
              {...register("salaryMin", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Salary max (per year)" htmlFor="salaryMax" error={errors.salaryMax?.message}>
            <Input
              id="salaryMax"
              type="number"
              min={0}
              step={1000}
              aria-invalid={!!errors.salaryMax}
              {...register("salaryMax", { valueAsNumber: true })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Description" description="Give a real sense of the work. Lists take one item per line.">
        <Field
          label="About the role"
          htmlFor="description"
          error={errors.description?.message}
          hint="At least 50 characters."
        >
          <Textarea id="description" rows={5} aria-invalid={!!errors.description} {...register("description")} />
        </Field>
        <Field label="Responsibilities" htmlFor="responsibilities" error={errors.responsibilities?.message} hint="One per line.">
          <Textarea id="responsibilities" rows={4} aria-invalid={!!errors.responsibilities} {...register("responsibilities")} />
        </Field>
        <Field label="Requirements" htmlFor="requirements" error={errors.requirements?.message} hint="One per line.">
          <Textarea id="requirements" rows={4} aria-invalid={!!errors.requirements} {...register("requirements")} />
        </Field>
        <Field label="Perks & benefits" htmlFor="perks" error={errors.perks?.message} hint="Optional. One per line.">
          <Textarea id="perks" rows={3} {...register("perks")} />
        </Field>
        <WordingHints control={control} />
      </Section>

      <Section title="Apply & skills" description="Applications are always submitted on Perch. Add the skills that matter.">
        <Field label="Skill tags" htmlFor="tags" error={errors.tags?.message} hint="Comma separated, e.g. React, TypeScript, GraphQL.">
          <Input id="tags" placeholder="React, TypeScript, Design Systems" aria-invalid={!!errors.tags} {...register("tags")} />
        </Field>
        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input accent-primary"
              {...register("noExperienceRequired")}
            />
            <span>
              No experience required
              <span className="block text-xs text-muted-foreground">
                Great fit for new grads, career switchers, and internships.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input accent-primary"
              {...register("visaSponsorship")}
            />
            <span>
              Visa sponsorship available
              <span className="block text-xs text-muted-foreground">
                Shown as a filter so candidates who need sponsorship can find this role.
              </span>
            </span>
          </label>
        </div>
      </Section>

      <Section
        title="Application questions"
        description="Ask up to 6 questions specific to this role. Candidates answer them when they apply."
      >
        <div className="space-y-4">
          {questionArray.fields.map((field, index) => (
            <QuestionRow
              key={field.id}
              index={index}
              control={control}
              register={register}
              setValue={setValue}
              defaultOptions={field.options}
              onRemove={() => questionArray.remove(index)}
              labelError={errors.questions?.[index]?.label?.message}
              optionsError={errors.questions?.[index]?.options?.message}
              knockoutError={errors.questions?.[index]?.knockoutAnswer?.message}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={questionArray.fields.length >= MAX_APPLICATION_QUESTIONS}
            onClick={() => questionArray.append(BLANK_QUESTION)}
          >
            <Plus className="size-4" />
            Add question
          </Button>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        {mode === "new" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => submit("draft")()}
            >
              {busy && intent === "draft" && <Loader2 className="size-4 animate-spin" />}
              Save as draft
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => submit("publish")()}
            >
              {busy && intent === "publish" && <Loader2 className="size-4 animate-spin" />}
              Publish
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => submit("save")()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        )}
      </div>
      <p className={cn("text-right text-xs text-muted-foreground", mode === "edit" && "hidden")}>
        Drafts stay private until you publish them.
      </p>
    </form>
  );
}

function QuestionRow({
  index,
  control,
  register,
  setValue,
  defaultOptions,
  onRemove,
  labelError,
  optionsError,
  knockoutError,
}: {
  index: number;
  control: Control<JobEditorValues>;
  register: UseFormRegister<JobEditorValues>;
  setValue: UseFormSetValue<JobEditorValues>;
  defaultOptions: string[];
  onRemove: () => void;
  labelError?: string;
  optionsError?: string;
  knockoutError?: string;
}) {
  const [optionsText, setOptionsText] = React.useState(defaultOptions.join("\n"));
  const type = useWatch({ control, name: `questions.${index}.type` });
  // Watched, not read from local state: the gate offers this question's own
  // options as its choices, so editing the options must re-render it.
  const options: string[] =
    useWatch({ control, name: `questions.${index}.options` }) ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1.5">
          <Input
            placeholder="e.g. What's your notice period?"
            aria-invalid={!!labelError}
            {...register(`questions.${index}.label`)}
          />
          {labelError && <p className="text-xs text-red-600 dark:text-red-400">{labelError}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove question"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select className="w-auto" {...register(`questions.${index}.type`)}>
          {APPLICATION_QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            {...register(`questions.${index}.required`)}
          />
          Required
        </label>
      </div>

      {type === "multiple_choice" && (
        <div className="space-y-1.5">
          <Textarea
            rows={3}
            placeholder="One option per line"
            aria-invalid={!!optionsError}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              setValue(`questions.${index}.options`, linesToList(e.target.value), {
                shouldValidate: true,
              });
            }}
          />
          {optionsError && (
            <p className="text-xs text-red-600 dark:text-red-400">{optionsError}</p>
          )}
        </div>
      )}

      {(type === "yes_no" || type === "multiple_choice") && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <label
            htmlFor={`knockout-${index}`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Screening gate (optional)
          </label>
          <Select
            id={`knockout-${index}`}
            className="w-auto"
            {...register(`questions.${index}.knockoutAnswer`)}
          >
            <option value="">No gate — accept any answer</option>
            {type === "yes_no" ? (
              <>
                <option value="yes">Only accept Yes</option>
                <option value="no">Only accept No</option>
              </>
            ) : (
              options.map((option) => (
                <option key={option} value={option}>
                  Only accept &ldquo;{option}&rdquo;
                </option>
              ))
            )}
          </Select>
          {knockoutError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{knockoutError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Anyone answering otherwise is told straight away that they are not
              eligible, instead of waiting for a reply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
