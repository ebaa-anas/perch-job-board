import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";

export interface AdminJobRow {
  id: string;
  title: string;
  slug: string;
  status: "published" | "draft" | "closed";
  companyName: string;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: "seeker" | "recruiter" | "admin" | null;
  fullName: string | null;
  createdAt: string;
}

export interface AdminOverview {
  users: number;
  jobs: number;
  publishedJobs: number;
  companies: number;
  applications: number;
}

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  await requireRole("admin");
  const admin = createAdminClient();
  const [users, jobs, published, companies, applications] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("jobs").select("id", { count: "exact", head: true }),
    admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("applications").select("id", { count: "exact", head: true }),
  ]);
  return {
    users: users.count ?? 0,
    jobs: jobs.count ?? 0,
    publishedJobs: published.count ?? 0,
    companies: companies.count ?? 0,
    applications: applications.count ?? 0,
  };
});

export const getAllJobsAdmin = cache(async (): Promise<AdminJobRow[]> => {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("jobs")
    .select("id, title, slug, status, created_at, companies!inner ( name )")
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    title: string;
    slug: string;
    status: AdminJobRow["status"];
    created_at: string;
    companies: { name: string };
  };
  return (data as unknown as Row[] | null ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    companyName: r.companies.name,
    createdAt: r.created_at,
  }));
});

export const getAllUsersAdmin = cache(async (): Promise<AdminUserRow[]> => {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, full_name");

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      { role: p.role as AdminUserRow["role"], fullName: p.full_name as string | null },
    ]),
  );

  return (authList?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "—",
    role: byId.get(u.id)?.role ?? null,
    fullName: byId.get(u.id)?.fullName ?? null,
    createdAt: u.created_at,
  }));
});
