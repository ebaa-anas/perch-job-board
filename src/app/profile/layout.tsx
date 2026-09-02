import type { ReactNode } from "react";

import { requireRole } from "@/features/auth/session";

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("seeker", "/profile");
  return children;
}
