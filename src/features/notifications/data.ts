import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";
import type { NotificationKind } from "@/features/notifications/notify";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export const getOwnNotifications = cache(
  async (limit = 30): Promise<AppNotification[]> => {
    const user = await getUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getOwnNotifications]", error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body,
      url: row.url,
      readAt: row.read_at,
      createdAt: row.created_at,
    }));
  },
);

/**
 * Unread count for the header badge.
 *
 * A `head: true` count, so the hottest query on the site — it runs on every
 * authenticated page render — never ships a row.
 */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const user = await getUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
});
