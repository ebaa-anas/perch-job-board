import type { ReactNode } from "react";

import { requireRole } from "@/features/auth/session";

export default async function CompanyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("recruiter", "/company");
  return children;
}
