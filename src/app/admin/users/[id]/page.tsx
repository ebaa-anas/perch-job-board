import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { getUserAdminDetail } from "@/features/admin/data";
import { formatDate } from "@/features/jobs/utils";
import { SeekerCvButton } from "@/features/admin/components/seeker-cv-button";
import { UserDeleteButton } from "@/features/admin/components/user-delete-button";

export const metadata: Metadata = { title: "User", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const u = await getUserAdminDetail(id);
  if (!u) notFound();

  const links = [
    { label: "Portfolio", href: u.seeker?.portfolioUrl },
    { label: "LinkedIn", href: u.seeker?.linkedinUrl },
    { label: "GitHub", href: u.seeker?.githubUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">{u.fullName || u.email}</h2>
          <p className="text-sm text-muted-foreground">
            {u.email} · <span className="capitalize">{u.role ?? "no role"}</span>{" "}
            · joined {formatDate(u.createdAt)}
          </p>
        </div>
        <UserDeleteButton userId={u.id} email={u.email} redirectTo="/admin/users" />
      </header>

      {u.role === "recruiter" && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Company</h3>
          {u.company ? (
            <Link
              href={`/admin/companies/${u.company.id}`}
              className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
            >
              {u.company.name}
              <ExternalLink className="size-3.5" />
            </Link>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No company profile yet.
            </p>
          )}
        </section>
      )}

      {u.seeker && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
          <h3 className="text-sm font-semibold">Seeker profile</h3>
          {u.seeker.headline && <p className="font-medium">{u.seeker.headline}</p>}
          {u.seeker.location && (
            <p className="text-muted-foreground">{u.seeker.location}</p>
          )}
          {u.seeker.bio && (
            <p className="whitespace-pre-line text-muted-foreground">
              {u.seeker.bio}
            </p>
          )}
          {u.seeker.skills.length > 0 && (
            <p className="text-muted-foreground">
              Skills: {u.seeker.skills.join(", ")}
            </p>
          )}
          {links.length > 0 && (
            <ul className="space-y-1">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {l.label}
                    <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {u.seeker.hasCv ? (
            <SeekerCvButton userId={u.id} filename={u.seeker.cvFilename} />
          ) : (
            <p className="text-muted-foreground">No CV uploaded.</p>
          )}
        </section>
      )}

      {u.role === "seeker" && (
        <section>
          <h3 className="font-display text-xl">
            Applications{" "}
            <span className="text-muted-foreground">({u.applications.length})</span>
          </h3>
          {u.applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-sm">
              {u.applications.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <span className="font-medium">{a.jobTitle}</span>{" "}
                    <span className="text-muted-foreground">
                      · {a.companyName}
                    </span>
                    {a.via === "external" && (
                      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                        via company site
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
