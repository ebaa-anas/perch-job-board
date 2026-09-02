"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
} from "@/features/jobs/types";
import {
  jobFormSchema,
  linesToList,
  tokensToList,
  type JobFormValues,
} from "@/features/jobs/schema";

const DEFAULTS: JobFormValues = {
  title: "",
  company: "",
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
  applyUrl: "",
};

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function FormSection({
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

export function JobForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload = {
      title: values.title,
      company: values.company,
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
      applyUrl: values.applyUrl,
    };

    let response: Response;
    try {
      response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setFormError("Network error — check your connection and try again.");
      return;
    }

    if (response.status === 201) {
      const { job } = (await response.json()) as { job: { id: string } };
      setDone(true);
      router.push(`/jobs/${job.id}`);
      router.refresh();
      return;
    }

    if (response.status === 422) {
      const { fieldErrors } = (await response.json()) as {
        fieldErrors?: Record<string, string[]>;
      };
      for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
        if (key in DEFAULTS && messages?.[0]) {
          setError(key as keyof JobFormValues, { message: messages[0] });
        }
      }
      setFormError("Please review the highlighted fields.");
      return;
    }

    setFormError("Something went wrong while posting the job. Please try again.");
  });

  const busy = isSubmitting || done;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <FormSection
        title="The role"
        description="The headline details candidates see first."
      >
        <Field label="Job title" htmlFor="title" error={errors.title?.message}>
          <Input
            id="title"
            placeholder="Senior Frontend Engineer"
            aria-invalid={!!errors.title}
            {...register("title")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Company"
            htmlFor="company"
            error={errors.company?.message}
          >
            <Input
              id="company"
              placeholder="Northwind Labs"
              aria-invalid={!!errors.company}
              {...register("company")}
            />
          </Field>
          <Field
            label="Location"
            htmlFor="location"
            error={errors.location?.message}
          >
            <Input
              id="location"
              placeholder="Berlin, Germany"
              aria-invalid={!!errors.location}
              {...register("location")}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Details"
        description="Employment type, ways of working, and compensation."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Job type" htmlFor="type" error={errors.type?.message}>
            <Select id="type" aria-invalid={!!errors.type} {...register("type")}>
              {JOB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {JOB_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Work mode"
            htmlFor="workMode"
            error={errors.workMode?.message}
          >
            <Select
              id="workMode"
              aria-invalid={!!errors.workMode}
              {...register("workMode")}
            >
              {WORK_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {WORK_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Experience"
            htmlFor="experience"
            error={errors.experience?.message}
          >
            <Select
              id="experience"
              aria-invalid={!!errors.experience}
              {...register("experience")}
            >
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EXPERIENCE_LABELS[level]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Salary min (USD / year)"
            htmlFor="salaryMin"
            error={errors.salaryMin?.message}
          >
            <Input
              id="salaryMin"
              type="number"
              min={0}
              step={1000}
              aria-invalid={!!errors.salaryMin}
              {...register("salaryMin", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Salary max (USD / year)"
            htmlFor="salaryMax"
            error={errors.salaryMax?.message}
          >
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
      </FormSection>

      <FormSection
        title="Description"
        description="Give candidates a real sense of the work. Lists take one item per line."
      >
        <Field
          label="About the role"
          htmlFor="description"
          error={errors.description?.message}
          hint="At least 50 characters."
        >
          <Textarea
            id="description"
            rows={5}
            placeholder="We're building…"
            aria-invalid={!!errors.description}
            {...register("description")}
          />
        </Field>
        <Field
          label="Responsibilities"
          htmlFor="responsibilities"
          error={errors.responsibilities?.message}
          hint="One per line."
        >
          <Textarea
            id="responsibilities"
            rows={4}
            placeholder={"Lead delivery of…\nProfile and fix…"}
            aria-invalid={!!errors.responsibilities}
            {...register("responsibilities")}
          />
        </Field>
        <Field
          label="Requirements"
          htmlFor="requirements"
          error={errors.requirements?.message}
          hint="One per line."
        >
          <Textarea
            id="requirements"
            rows={4}
            placeholder={"5+ years with…\nDeep knowledge of…"}
            aria-invalid={!!errors.requirements}
            {...register("requirements")}
          />
        </Field>
        <Field
          label="Perks & benefits"
          htmlFor="perks"
          error={errors.perks?.message}
          hint="Optional. One per line."
        >
          <Textarea
            id="perks"
            rows={3}
            placeholder={"4 weeks paid vacation\nHome-office budget"}
            {...register("perks")}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Apply & skills"
        description="Where candidates apply, and the skills that matter."
      >
        <Field
          label="Application URL"
          htmlFor="applyUrl"
          error={errors.applyUrl?.message}
        >
          <Input
            id="applyUrl"
            type="url"
            placeholder="https://example.com/apply/…"
            aria-invalid={!!errors.applyUrl}
            {...register("applyUrl")}
          />
        </Field>
        <Field
          label="Skill tags"
          htmlFor="tags"
          error={errors.tags?.message}
          hint="Comma separated, e.g. React, TypeScript, GraphQL."
        >
          <Input
            id="tags"
            placeholder="React, TypeScript, Design Systems"
            aria-invalid={!!errors.tags}
            {...register("tags")}
          />
        </Field>
      </FormSection>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? "Posting…" : "Publish job"}
        </Button>
      </div>
    </form>
  );
}
