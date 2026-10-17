"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import { ALERT_FREQUENCIES } from "@/features/alerts/schedule";
import { MAX_SAVED_SEARCHES } from "@/features/alerts/data";
import { filtersToSearchParams, parseJobFilters } from "@/features/jobs/utils";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Saved-search mutations.
 *
 * The incoming query string is never trusted verbatim: it is parsed with the
 * browse page's own `parseJobFilters` and re-serialised with
 * `filtersToSearchParams`. That drops unknown keys, normalises ordering, and
 * makes the `unique (seeker_id, query)` constraint meaningful — otherwise
 * `?mode=remote&q=rust` and `?q=rust&mode=remote` would be two alerts for the
 * same search.
 */
function canonicalise(query: string): string {
  const filters = parseJobFilters(
    Object.fromEntries(new URLSearchParams(query)) as Record<string, string>,
  );
  return filtersToSearchParams(filters).toString();
}

const saveSchema = z.object({
  label: z.string().trim().min(1, "Give the alert a name.").max(80),
  query: z.string().max(2000),
  frequency: z.enum(ALERT_FREQUENCIES),
});

export async function saveSearch(input: {
  label: string;
  query: string;
  frequency: "daily" | "weekly";
}): Promise<Result> {
  const profile = await requireRole("seeker");

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("seeker_id", profile.id);

  if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
    return {
      ok: false,
      error: `You can keep ${MAX_SAVED_SEARCHES} alerts. Delete one to add another.`,
    };
  }

  const { error } = await supabase.from("saved_searches").insert({
    seeker_id: profile.id,
    label: parsed.data.label,
    query: canonicalise(parsed.data.query),
    frequency: parsed.data.frequency,
  });

  if (error) {
    // 23505 = unique violation on (seeker_id, query): they already have it.
    if (error.code === "23505") {
      return { ok: false, error: "You already have an alert for this search." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/alerts");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function updateSavedSearch(input: {
  id: string;
  label?: string;
  frequency?: "daily" | "weekly";
}): Promise<Result> {
  await requireRole("seeker");

  const parsed = z
    .object({
      id: z.string().uuid(),
      label: z.string().trim().min(1).max(80).optional(),
      frequency: z.enum(ALERT_FREQUENCIES).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const patch: { label?: string; frequency?: string } = {};
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.frequency !== undefined) patch.frequency = parsed.data.frequency;
  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_searches")
    .update(patch)
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteSavedSearch(id: string): Promise<Result> {
  await requireRole("seeker");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/alerts");
  revalidatePath("/jobs");
  return { ok: true };
}
