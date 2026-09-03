import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireRole } from "@/features/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CompanyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole("recruiter", "/company");
  return children;
}
