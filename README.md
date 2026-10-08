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
- **Postgres-backed rate limiting** on the public write paths (apply, signup,
  reviews) — counters live in the database because serverless functions share
  no memory
- **Transparent applicant matching** — deterministic skill overlap, not an AI
  ranking: ranking applicants algorithmically is high-risk under the EU AI Act
  and every point here is attributable to a named skill tag
- **Salary benchmarking** from the board's own postings, published only above a
  10-posting threshold so no single employer's range is recoverable
- **Claude** (REST, Anthropic Messages API) for the seeker-facing AI fit score — optional, degrades gracefully; scores are cached per (seeker, job) and capped at 50 fresh scorings per seeker per day
- **lucide-react** icons
- **Vercel Cron** for the daily job-alert digest (`/api/alerts/run`)

## Company teams

A company has many recruiters. `company_members` holds the seats
(`owner` / `admin` / `recruiter`) and is the single source of authorisation:
migration 0018 redefines the `owns_company()`, `owns_job()` and
`owns_application()` SQL helpers in terms of membership, so every policy
written against them became team-aware without being edited. Seats are
one-per-person, which keeps every "my company" read single-valued.

Joining happens only through `accept_company_invite()` — an invitee is by
definition not yet a member, so no RLS policy could admit them without also
admitting self-insertion into any company.

## Roles & routes

```
PUBLIC
  /                     landing page
  /jobs                 browse: ?q ?type ?mode ?level ?minSalary ?sort
  /jobs/[slug]          job detail + apply + pay-in-context benchmark
  /companies/[slug]     company profile + its published jobs
  /login /signup /onboarding
  /auth/callback /auth/reset /auth/auth-code-error

SEEKER (role='seeker')
  /dashboard            "My applications" (with employer status) + quick links
  /profile             headline, skills, links, CV upload
  /saved-jobs          shortlist (localStorage as guest, DB when signed in)
  /alerts              saved searches + daily/weekly digest frequency

ANY SIGNED-IN USER
  /notifications       in-app notification centre

RECRUITER (role='recruiter')
  /dashboard                    own jobs grouped by status + applicant counts
  /dashboard/analytics          per-job funnel: views, apply rate, reply time
  /dashboard/jobs/new           post (draft | publish)
  /dashboard/jobs/import        bulk CSV import (preview, then draft/publish)
  /dashboard/jobs/[id]/edit
  /dashboard/jobs/[id]/applicants   list + stage filter + bulk moves +
                                    detail drawer (pipeline, rating,
                                    internal notes, history) + CV download
  /company                     company profile + logo
  /company/team                seats, invitations, ownership transfer
  /join?token=…                accept a team invitation (any signed-in user)

ADMIN (email in admin_emails → role auto-upgraded on login)
  /admin               jobs / users / demo-data moderation

API
  GET /api/jobs        public JSON list (same query params)
  GET /api/jobs/[slug] one job
  GET /api/health      weekly Vercel Cron keep-alive
  GET /api/alerts/run  daily Vercel Cron; sends job-alert digests (CRON_SECRET)

SEO
  /sitemap.xml         published jobs + companies with open roles (1h revalidate)
  /robots.txt          allows the public board, disallows every auth-gated path
  /jobs/[slug]         emits schema.org JobPosting JSON-LD (Google for Jobs)
```

Route protection: `proxy.ts` redirects signed-out users off `/dashboard`,
`/profile`, `/company`, `/admin`, `/alerts`, `/notifications`; each of those segments' `layout.tsx` enforces
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
    matching/             fit-score prompt, schema, cached action, score card
    alerts/               saved searches, due-check, digest runner, UI
    notifications/        in-app notification centre (read + write helpers)
    seo/                  sitemap/robots data (service-role, session-free)
    team/                 seats, roles/capabilities, invites, ownership
    analytics/            view counting + per-job funnel maths
    salary/               pay benchmarking from the board's own corpus
  lib/supabase/            server / client / admin / proxy factories
  lib/i18n/                locale cookie, provider, en/tr dictionaries
  lib/                     slug, email, claude, utils
supabase/migrations/       0001 schema → 0020 screening gates
```

## Local development

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in the Supabase URL + keys + DB
   password (Project Settings → API). `NEXT_PUBLIC_SITE_URL` should be the
   canonical origin. `RESEND_API_KEY` and `ANTHROPIC_API_KEY` are both optional.
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
