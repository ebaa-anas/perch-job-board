import type { ReactNode } from "react";

import { requireRole } from "@/features/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("admin", "/admin");
  return children;
}
