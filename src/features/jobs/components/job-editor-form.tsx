"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
  jobEditorSchema,
  linesToList,
  tokensToList,
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
  applyUrl: "",
};

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
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobEditorValues>({
    resolver: zodResolver(jobEditorSchema),
    defaultValues: initial ?? BLANK,
    mode: "onBlur",
  });

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
        applyUrl: values.applyUrl ?? "",
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
      </Section>

      <Section title="Apply & skills" description="Where candidates apply, and the skills that matter.">
        <Field
          label="External application URL"
          htmlFor="applyUrl"
          error={errors.applyUrl?.message}
          hint="Optional. Leave blank to collect applications on Perch."
        >
          <Input id="applyUrl" type="url" placeholder="https://example.com/apply/…" aria-invalid={!!errors.applyUrl} {...register("applyUrl")} />
        </Field>
        <Field label="Skill tags" htmlFor="tags" error={errors.tags?.message} hint="Comma separated, e.g. React, TypeScript, GraphQL.">
          <Input id="tags" placeholder="React, TypeScript, Design Systems" aria-invalid={!!errors.tags} {...register("tags")} />
        </Field>
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
