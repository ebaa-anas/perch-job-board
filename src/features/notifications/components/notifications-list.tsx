"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/features/jobs/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import type { AppNotification } from "@/features/notifications/data";

export function NotificationsList({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const unread = notifications.filter((n) => !n.readAt).length;

  const markAll = async () => {
    setBusy(true);
    await markAllNotificationsRead();
    setBusy(false);
    router.refresh();
  };

  if (notifications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <BellOff className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 font-display text-2xl">Nothing yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Updates about your applications and your saved searches land here.
        </p>
      </div>
    );
  }

  return (
    <>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={markAll} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Mark all read
          </Button>
        </div>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {notifications.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        ))}
      </ul>
    </>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const unread = !notification.readAt;

  // Reading is the act of opening it, so the mark-read happens on click rather
  // than behind a second control the user has to find.
  const open = async () => {
    if (unread) await markNotificationRead(notification.id);
    if (notification.url) router.push(notification.url);
    else router.refresh();
  };

  const body = (
    <>
      <span className="flex items-start gap-2">
        {unread && (
          <span
            aria-label="Unread"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          />
        )}
        <span className={unread ? "font-medium" : ""}>{notification.title}</span>
      </span>
      {notification.body && (
        <span className="mt-0.5 block whitespace-pre-line text-sm text-muted-foreground">
          {notification.body}
        </span>
      )}
      <span className="mt-1 block text-xs text-muted-foreground">
        {formatRelativeDate(notification.createdAt)}
      </span>
    </>
  );

  return (
    <li>
      {notification.url ? (
        <Link
          href={notification.url}
          onClick={() => {
            if (unread) void markNotificationRead(notification.id);
          }}
          className="block p-4 text-left transition-colors hover:bg-muted/50"
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={open}
          className="block w-full p-4 text-left transition-colors hover:bg-muted/50"
        >
          {body}
        </button>
      )}
    </li>
  );
}
