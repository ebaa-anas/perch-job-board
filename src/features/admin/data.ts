import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";
import type { Company } from "@/features/companies/data";
import type { ReportReason } from "@/features/companies/schema";
import type { ContentLanguage } from "@/features/jobs/types";

/* -------------------------------------------------------------------------- */
/*  Users                                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminUserRow {
  id: string;
  email: string;
  role: "seeker" | "recruiter" | "admin" | null;
  fullName: string | null;
  createdAt: string;
}

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

/* -------------------------------------------------------------------------- */
/*  Companies                                                                  */
/* -------------------------------------------------------------------------- */

export interface AdminCompanyRow {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  jobs: number;
  published: number;
  applicants: number;
  openReports: number;
  suspendedAt: string | null;
  createdAt: string;
}

export const getCompaniesAdmin = cache(async (): Promise<AdminCompanyRow[]> => {
  await requireRole("admin");
  const admin = createAdminClient();

  const [companiesRes, jobsRes, appsRes, reportsRes, usersRes] = await Promise.all([
    admin
      .from("companies")
      .select("id, name, slug, owner_id, suspended_at, created_at")
      .order("created_at", { ascending: false }),
    admin.from("jobs").select("company_id, status"),
    admin.from("applications").select("jobs!inner ( company_id )"),
    admin.from("company_reports").select("company_id, status"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  const jobsByCompany = new Map<string, { total: number; published: number }>();
  for (const j of jobsRes.data ?? []) {
    const row = j as { company_id: string; status: string };
    const acc = jobsByCompany.get(row.company_id) ?? { total: 0, published: 0 };
    acc.total += 1;
    if (row.status === "published") acc.published += 1;
    jobsByCompany.set(row.company_id, acc);
  }

  const applicantsByCompany = new Map<string, number>();
  for (const a of appsRes.data ?? []) {
    const id = (a as { jobs: { company_id: string } }).jobs.company_id;
    applicantsByCompany.set(id, (applicantsByCompany.get(id) ?? 0) + 1);
  }

  const openReportsByCompany = new Map<string, number>();
  for (const r of reportsRes.data ?? []) {
    const row = r as { company_id: string; status: string };
    if (row.status !== "open") continue;
    openReportsByCompany.set(
      row.company_id,
      (openReportsByCompany.get(row.company_id) ?? 0) + 1,
    );
  }

  return (companiesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    ownerEmail: c.owner_id ? emailById.get(c.owner_id) ?? null : null,
    jobs: jobsByCompany.get(c.id)?.total ?? 0,
    published: jobsByCompany.get(c.id)?.published ?? 0,
    applicants: applicantsByCompany.get(c.id) ?? 0,
    openReports: openReportsByCompany.get(c.id) ?? 0,
    suspendedAt: c.suspended_at,
    createdAt: c.created_at,
  }));
});

export interface AdminJobRow {
  id: string;
  title: string;
  slug: string;
  status: "published" | "draft" | "closed";
  createdAt: string;
  applicants: number;
}

export interface AdminReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: "visible" | "hidden";
  createdAt: string;
  reviewerEmail: string | null;
}

export interface AdminCompanyDetail {
  company: Company;
  ownerEmail: string | null;
  jobs: AdminJobRow[];
  reports: AdminReportRow[];
  reviews: AdminReviewRow[];
}

export const getCompanyAdminDetail = cache(
  async (id: string): Promise<AdminCompanyDetail | null> => {
    await requireRole("admin");
    const admin = createAdminClient();

    const { data: c } = await admin
      .from("companies")
      .select(
        "id, owner_id, name, slug, tagline, description, website, logo_path, logo_color, language, suspended_at, suspended_reason",
      )
      .eq("id", id)
      .maybeSingle();
    if (!c) return null;

    const [jobsRes, appsRes, reportsRes, reviewsRes, ownerRes, usersRes] =
      await Promise.all([
        admin
          .from("jobs")
          .select("id, title, slug, status, created_at")
          .eq("company_id", id)
          .order("created_at", { ascending: false }),
        admin
          .from("applications")
          .select("job_id, jobs!inner ( company_id )")
          .eq("jobs.company_id", id),
        admin
          .from("company_reports")
          .select("id, reason, detail, status, created_at, reporter_id")
          .eq("company_id", id)
          .order("created_at", { ascending: false }),
        admin
          .from("company_reviews")
          .select("id, rating, title, body, status, created_at, reviewer_id")
          .eq("company_id", id)
          .order("created_at", { ascending: false }),
        c.owner_id
          ? admin.auth.admin.getUserById(c.owner_id)
          : Promise.resolve({ data: { user: null } }),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ]);

    const applicantsByJob = new Map<string, number>();
    for (const a of appsRes.data ?? []) {
      const jid = (a as { job_id: string }).job_id;
      applicantsByJob.set(jid, (applicantsByJob.get(jid) ?? 0) + 1);
    }

    const emailById = new Map(
      (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    return {
      company: {
        id: c.id,
        ownerId: c.owner_id,
        name: c.name,
        slug: c.slug,
        tagline: c.tagline,
        description: c.description,
        website: c.website,
        logoPath: c.logo_path,
        logoColor: c.logo_color,
        language: (c.language as ContentLanguage) ?? "en",
        suspendedAt: c.suspended_at,
        suspendedReason: c.suspended_reason,
      },
      ownerEmail: ownerRes.data.user?.email ?? null,
      jobs: (jobsRes.data ?? []).map((j) => ({
        id: j.id,
        title: j.title,
        slug: j.slug,
        status: j.status as AdminJobRow["status"],
        createdAt: j.created_at,
        applicants: applicantsByJob.get(j.id) ?? 0,
      })),
      reports: (reportsRes.data ?? []).map((r) => ({
        id: r.id,
        companyId: id,
        companyName: c.name,
        companySlug: c.slug,
        reason: r.reason as ReportReason,
        detail: r.detail,
        status: r.status as AdminReportRow["status"],
        createdAt: r.created_at,
        reporterEmail: emailById.get(r.reporter_id as string) ?? null,
      })),
      reviews: (reviewsRes.data ?? []).map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status as AdminReviewRow["status"],
        createdAt: r.created_at,
        reviewerEmail: emailById.get(r.reviewer_id as string) ?? null,
      })),
    };
  },
);

/* -------------------------------------------------------------------------- */
/*  User detail                                                                */
/* -------------------------------------------------------------------------- */

export interface AdminUserDetail {
  id: string;
  email: string;
  role: "seeker" | "recruiter" | "admin" | null;
  fullName: string | null;
  createdAt: string;
  seeker: {
    headline: string | null;
    location: string | null;
    bio: string | null;
    skills: string[];
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    hasCv: boolean;
    cvFilename: string | null;
  } | null;
  applications: {
    id: string;
    via: "onsite" | "external";
    createdAt: string;
    jobTitle: string;
    companyName: string;
  }[];
  company: { id: string; name: string; slug: string } | null;
}

export const getUserAdminDetail = cache(
  async (id: string): Promise<AdminUserDetail | null> => {
    await requireRole("admin");
    const admin = createAdminClient();

    const { data: authUser } = await admin.auth.admin.getUserById(id);
    if (!authUser.user) return null;

    const [profileRes, seekerRes, appsRes, companyRes] = await Promise.all([
      admin.from("profiles").select("role, full_name").eq("id", id).maybeSingle(),
      admin
        .from("seeker_profiles")
        .select(
          "headline, location, bio, skills, portfolio_url, linkedin_url, github_url, cv_path, cv_filename",
        )
        .eq("profile_id", id)
        .maybeSingle(),
      admin
        .from("applications")
        .select("id, via, created_at, jobs!inner ( title, companies!inner ( name ) )")
        .eq("seeker_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("companies")
        .select("id, name, slug")
        .eq("owner_id", id)
        .maybeSingle(),
    ]);

    const sp = seekerRes.data;
    type AppRow = {
      id: string;
      via: string | null;
      created_at: string;
      jobs: { title: string; companies: { name: string } };
    };

    return {
      id,
      email: authUser.user.email ?? "—",
      role: (profileRes.data?.role as AdminUserDetail["role"]) ?? null,
      fullName: profileRes.data?.full_name ?? null,
      createdAt: authUser.user.created_at,
      seeker: sp
        ? {
            headline: sp.headline,
            location: sp.location,
            bio: sp.bio,
            skills: sp.skills ?? [],
            portfolioUrl: sp.portfolio_url,
            linkedinUrl: sp.linkedin_url,
            githubUrl: sp.github_url,
            hasCv: Boolean(sp.cv_path),
            cvFilename: sp.cv_filename,
          }
        : null,
      applications: ((appsRes.data as unknown as AppRow[] | null) ?? []).map((a) => ({
        id: a.id,
        via: (a.via as "onsite" | "external") ?? "onsite",
        createdAt: a.created_at,
        jobTitle: a.jobs.title,
        companyName: a.jobs.companies.name,
      })),
      company: companyRes.data
        ? { id: companyRes.data.id, name: companyRes.data.name, slug: companyRes.data.slug }
        : null,
    };
  },
);

/* -------------------------------------------------------------------------- */
/*  Reports                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminReportRow {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  reason: ReportReason;
  detail: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reporterEmail: string | null;
}

export const getReportsAdmin = cache(
  async (
    status?: "open" | "reviewed" | "dismissed",
  ): Promise<AdminReportRow[]> => {
    await requireRole("admin");
    const admin = createAdminClient();

    let query = admin
      .from("company_reports")
      .select(
        "id, company_id, reason, detail, status, created_at, reporter_id, companies!inner ( name, slug )",
      )
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data } = await query;

    const reporterIds = Array.from(
      new Set((data ?? []).map((r) => r.reporter_id as string)),
    );
    const emails = new Map<string, string | null>();
    if (reporterIds.length > 0) {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users?.users ?? []) {
        if (reporterIds.includes(u.id)) emails.set(u.id, u.email ?? null);
      }
    }

    type Row = {
      id: string;
      company_id: string;
      reason: string;
      detail: string | null;
      status: string;
      created_at: string;
      reporter_id: string;
      companies: { name: string; slug: string };
    };

    return (data as unknown as Row[] | null ?? []).map((r) => ({
      id: r.id,
      companyId: r.company_id,
      companyName: r.companies.name,
      companySlug: r.companies.slug,
      reason: r.reason as ReportReason,
      detail: r.detail,
      status: r.status as AdminReportRow["status"],
      createdAt: r.created_at,
      reporterEmail: emails.get(r.reporter_id) ?? null,
    }));
  },
);

/* -------------------------------------------------------------------------- */
/*  Settings — admin allow-list + audit log                                    */
/* -------------------------------------------------------------------------- */

export const getAdminEmails = cache(async (): Promise<string[]> => {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_emails")
    .select("email")
    .order("email");
  return (data ?? []).map((r) => r.email as string);
});

export interface AuditEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: unknown;
  createdAt: string;
}

export const getAuditLog = cache(async (limit = 50): Promise<AuditEntry[]> => {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_audit_log")
    .select("id, actor_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    detail: r.detail,
    createdAt: r.created_at,
  }));
});
