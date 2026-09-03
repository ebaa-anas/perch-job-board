import type { ReactNode } from "react";

import { requireRole } from "@/features/auth/session";
import { AdminNav } from "@/features/admin/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("admin", "/admin");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl">Admin</h1>
      </div>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
