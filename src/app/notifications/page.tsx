import type { Metadata } from "next";

import { requireUser } from "@/features/auth/session";
import { getOwnNotifications } from "@/features/notifications/data";
import { NotificationsList } from "@/features/notifications/components/notifications-list";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  // Both roles get notifications, so this gates on a session, not a role.
  await requireUser("/notifications");
  const notifications = await getOwnNotifications();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">Notifications</h1>

      <div className="mt-8">
        <NotificationsList notifications={notifications} />
      </div>
    </div>
  );
}
