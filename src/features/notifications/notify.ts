import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writing notifications.
 *
 * Always over the service-role client, because the writer is never the
 * recipient: an alert run has no session at all, and a recruiter moving a
 * candidate's application is writing into *that candidate's* feed. The
 * `notifications` table has no INSERT policy for exactly this reason
 * (migration 0017), so an ordinary authenticated user cannot forge an entry.
 *
 * Every function here is best-effort: a dropped notification must never fail
 * the action that triggered it.
 */

export type NotificationKind = "job_alert" | "application_status" | "system";

export interface NotificationInput {
  profileId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  url?: string | null;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  await createNotifications([input]);
}

/** One round-trip for a batch — the alert runner writes many at once. */
export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const { error } = await createAdminClient()
      .from("notifications")
      .insert(
        inputs.map((input) => ({
          profile_id: input.profileId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          url: input.url ?? null,
        })),
      );
    if (error) console.error("[notify] insert failed", error);
  } catch (error) {
    console.error("[notify] unavailable", error);
  }
}
