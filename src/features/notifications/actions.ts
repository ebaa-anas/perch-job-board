"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/auth/session";

type Result = { ok: boolean; error?: string };

/**
 * Marking notifications read.
 *
 * `requireUser`, not `requireRole`: recruiters get notifications too, and RLS
 * scopes every statement here to `profile_id = auth.uid()` regardless.
 */

export async function markNotificationRead(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}
