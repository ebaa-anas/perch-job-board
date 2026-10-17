import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import {
  ALERT_FREQUENCIES,
  type AlertFrequency,
} from "@/features/alerts/schedule";

export interface SavedSearch {
  id: string;
  label: string;
  /** A `/jobs` search-params string, e.g. `q=rust&mode=remote`. */
  query: string;
  frequency: AlertFrequency;
  lastRunAt: string | null;
  createdAt: string;
}

/** Guards against one account turning the alert runner into a mail cannon. */
export const MAX_SAVED_SEARCHES = 20;

function asFrequency(value: string | null): AlertFrequency {
  return (ALERT_FREQUENCIES as readonly string[]).includes(value ?? "")
    ? (value as AlertFrequency)
    : "daily";
}

export const getOwnSavedSearches = cache(async (): Promise<SavedSearch[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, label, query, frequency, last_run_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getOwnSavedSearches]", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    query: row.query,
    frequency: asFrequency(row.frequency),
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
  }));
});

/** Does the signed-in seeker already have an alert for this exact query? */
export const hasSavedSearch = cache(async (query: string): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("seeker_id", user.id)
    .eq("query", query);
  return (count ?? 0) > 0;
});
