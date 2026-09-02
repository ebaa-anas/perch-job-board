# Perch — a two-sided job board

A job board built with the Next.js App Router. Seekers browse, filter, save and
apply; recruiters post roles and review applicants; an admin moderates. Data
lives in Supabase Postgres with row-level security as the boundary.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with light/dark theming (no flash of wrong theme)
- **Supabase** — Postgres, Auth (email + Google), Storage, RLS; `@supabase/ssr`
- **React Hook Form + Zod** for every form
- **Resend** (REST) for the "new applicant" email — optional, degrades gracefully
- **lucide-react** icons

## Roles & routes

```
PUBLIC
  /                     landing page
  /jobs                 browse: ?q ?type ?mode ?level ?minSalary ?sort
  /jobs/[slug]          job detail + apply
  /companies/[slug]     company profile + its published jobs
  /login /signup /onboarding
  /auth/callback /auth/reset /auth/auth-code-error

SEEKER (role='seeker')
  /dashboard            "My applications" + quick links
  /profile             headline, skills, links, CV upload
  /saved-jobs          shortlist (localStorage as guest, DB when signed in)

RECRUITER (role='recruiter')
  /dashboard                    own jobs grouped by status + applicant counts
  /dashboard/jobs/new           post (draft | publish)
  /dashboard/jobs/[id]/edit
  /dashboard/jobs/[id]/applicants   list + detail drawer + CV download
  /company                     company profile + logo

ADMIN (email in admin_emails → role auto-upgraded on login)
  /admin               jobs / users / demo-data moderation

API
  GET /api/jobs        public JSON list (same query params)
  GET /api/jobs/[slug] one job
  GET /api/health      weekly Vercel Cron keep-alive
```

Route protection: `proxy.ts` redirects signed-out users off `/dashboard`,
`/profile`, `/company`, `/admin`; each of those segments' `layout.tsx` enforces
the exact role via `requireRole`.

## Architecture

Feature-based. Route files stay thin; everything reusable lives under
`src/features/*`.

```
src/
  app/                     routing only — pages, layouts, route handlers
  components/
    ui/                    design-system primitives
    layout/                header (role-aware) / footer / theme toggle / user menu
    brand/                 <Logo> / <Wordmark>
  features/
    jobs/                  data, schema, actions, JobCard/JobList/JobDetail/editor
    saved-jobs/            provider (localStorage + DB), actions
    auth/                  session helpers, server actions, forms, redirect guard
    profiles/             seeker profile + CV upload
    companies/            company profile + logo + public page data
    applications/         apply dialog, applicants list/drawer, actions, email
    admin/                overview, tables, moderation actions
    marketing/            landing-page sections
  lib/supabase/            server / client / admin / proxy factories
  lib/                     slug, email, utils
supabase/migrations/       0001 schema → 0006 saved-jobs RLS
```

## Local development

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in the Supabase URL + keys + DB
   password (Project Settings → API). `NEXT_PUBLIC_SITE_URL` should be the
   canonical origin. `RESEND_API_KEY` is optional.
3. `npx supabase link --project-ref <your-ref>` (one-time), then
   `npm run db:push` to apply migrations and `npm run seed` for the demo data.
4. `npm run dev` → http://localhost:3000

Run the Supabase CLI from PowerShell on Windows (Git Bash breaks the Go binary).

## Scripts

```bash
npm run dev
npm run build && npm run start
npm run lint                  # eslint
npx tsc --noEmit              # type check
npm run test:unit             # unit tests only
npm test                      # unit + integration (integration hits the linked DB)
npm run db:push               # apply migrations
npm run db:types              # regenerate src/lib/supabase/database.types.ts
npm run seed                  # demo companies + jobs + admin email
```

Deploy: see `docs/DEPLOYMENT.md`.
