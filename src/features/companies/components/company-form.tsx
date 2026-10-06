"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import { Field, FormError } from "@/features/auth/components/auth-ui";
import { upsertCompany } from "@/features/companies/actions";
import { companySchema, type CompanyValues } from "@/features/companies/schema";

export function CompanyForm({
  initial,
  hasCompany,
}: {
  initial: CompanyValues;
  hasCompany: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(hasCompany);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: initial,
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await upsertCompany(values);
    if (!result.ok) {
      setFormError(result.error);
      for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(key as keyof CompanyValues, { message });
      }
      return;
    }
    setSaved(true);
    setValue("slug", result.data.slug, { shouldDirty: false });
    router.refresh();
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      noValidate
    >
      <FormError message={formError} />

      <Field label="Company name" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          placeholder="Northwind Labs"
          aria-invalid={!!errors.name}
          {...register("name", {
            onChange: (e) => {
              if (!slugTouched) {
                setValue("slug", slugify(e.target.value), {
                  shouldValidate: true,
                });
              }
            },
          })}
        />
      </Field>

      <Field
        label="Slug"
        htmlFor="slug"
        error={errors.slug?.message}
        hint="Your public URL: /companies/<slug>. Adjusted automatically if taken."
      >
        <Input
          id="slug"
          placeholder="northwind-labs"
          aria-invalid={!!errors.slug}
          {...register("slug", { onChange: () => setSlugTouched(true) })}
        />
      </Field>

      <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message}>
        <Input
          id="tagline"
          placeholder="Developer tools for data teams"
          aria-invalid={!!errors.tagline}
          {...register("tagline")}
        />
      </Field>

      <Field
        label="About"
        htmlFor="description"
        error={errors.description?.message}
        hint="What the company does, size, culture."
      >
        <Textarea
          id="description"
          rows={6}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
      </Field>

      <Field label="Website" htmlFor="website" error={errors.website?.message}>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          aria-invalid={!!errors.website}
          {...register("website")}
        />
      </Field>

      <Field
        label="Language"
        htmlFor="language"
        error={errors.language?.message}
        hint="The language your profile and job posts are written in."
      >
        <Select id="language" {...register("language")}>
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting
            ? "Saving…"
            : hasCompany
              ? "Save changes"
              : "Create company"}
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
