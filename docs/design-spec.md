# Perch v1 — two-sided job board: design spec

**Status:** approved for planning · **Date:** 2026-09-02

Turns the current single-user, file-backed listings board into a publicly
hosted, two-sided marketplace: job seekers and recruiters each have accounts,
seekers apply to jobs on-site, recruiters manage postings and review applicants.

---

## 1. Goals

- The site runs on the public internet; anyone can browse without an account.
- Recruiters can self-register, post jobs (live immediately), and see who applied.
- Job seekers can self-register, keep a profile, apply to jobs on-site, and track
  their applications and saved jobs.
- Data persists in a real database (not the local filesystem).
- The owner can remove abusive content and accounts.
- Keep the existing feature-based architecture, UI kit, and visual design.

## 2. Non-goals (v1)

Application status pipeline / recruiter notes on candidates; in-app messaging;
job alerts, saved searches, email digests; multiple recruiters per company;
structured work history / résumé builder; payments or featured listings; public
candidate search / recruiter-initiated outreach; ratings & reviews;
internationalization; rate-limiting / CAPTCHA (see §13, accepted risk).

## 3. Personas & roles

Exactly one role per account, chosen at signup and fixed thereafter.

| Role | Can |
| --- | --- |
| **Guest** (no account) | Browse, search, filter, view jobs and company pages; save jobs to `localStorage` only |
| **Seeker** (`role='seeker'`) | Everything a guest can, plus: maintain a profile, upload a CV, apply to jobs, track applications, sync saved jobs to their account |
| **Recruiter** (`role='recruiter'`) | Everything a guest can (browsing), plus: maintain one company profile, create/edit/publish/close jobs, view applicants for their own jobs |
| **Admin** (`role='admin'`) | Delete any job; delete/ban any user; manage demo data |

A seeker account cannot post; a recruiter account cannot apply. Someone needing
both creates two accounts.

## 4. Stack

- **Hosting:** Vercel (Hobby / free tier). Auto-deploy from GitHub `main`.
- **Backend:** Supabase (free tier) — PostgreSQL, Auth, Storage, Row-Level
  Security.
- **Framework:** existing Next.js 16 App Router + React 19 + TypeScript app.
- **Supabase integration:** `@supabase/supabase-js` + `@supabase/ssr` for
  cookie-based auth in Server Components, Server Actions, Route Handlers, and
  `proxy.ts` (Next 16's renamed middleware).
- **Email:** Resend (`resend` SDK) for the single transactional email; Supabase
  sends its own auth emails (verification, password reset, OAuth).
- **Authorization:** enforced in the database with RLS policies. App code adds
  role-based UI gating and redirects but is not the security boundary.

### Approach chosen

**Supabase-native.** Server-side code calls the Supabase client directly; RLS is
the authorization layer. Rejected: "Supabase as plain Postgres + Drizzle/Prisma"
(more code, every ownership check hand-maintained, no DB-enforced safety) and the
hybrid of the two (most moving parts).

### Visual design

The existing `globals.css` token set and `components/ui/*` kit are the design
system for every new surface — dashboards, forms, admin, auth pages all reuse
`Button`, `Input`, `Select`, `Card`, `Badge`, `EmptyState`, etc. As of
2026-09-02 the palette was reworked away from the generic indigo/violet + cold
grey + rainbow-mesh look:

- **Primary:** deep spruce green (`--primary`), with a warm rust `--highlight`
  used sparingly.
- **Neutrals:** warm ivory / sand (`--background`, `--muted`, `--border`), not
  cold zinc.
- **Texture:** `.bg-editorial` (single-hue wash) + `.grain` (film-grain overlay)
  replace `.bg-mesh`.
- **Type:** Instrument Serif (`--font-display`, `.font-display` utility) for
  large headings; Geist for body and UI.
- **Radius:** `--radius: 0.625rem`.

New components must not introduce ad-hoc colours — use the tokens. Recruiter and
seeker dashboards should feel like the same product as the public board.

## 5. Configuration (environment variables)

| Var | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin tasks (seed script, admin deletes that bypass RLS); never sent to the client |
| `RESEND_API_KEY` | server only | Transactional email |
| `EMAIL_FROM` | server only | e.g. `Perch <jobs@yourdomain>`; requires a verified Resend domain for arbitrary recipients |
| `NEXT_PUBLIC_SITE_URL` | client + server | Canonical origin, for OAuth `redirectTo` and email links |

`.env.local` for development, Vercel project env for production. `.env.example`
is committed with placeholder values and notes.

## 6. Data model

PostgreSQL. All tables in the `public` schema. `id` columns are `uuid default
gen_random_uuid()` unless noted. All tables have RLS **enabled**.

**IDs vs slugs.** Public URLs use human-readable slugs: `/jobs/[slug]`,
`/companies/[slug]`. Owner-only / internal routes use the `uuid` primary key:
`/dashboard/jobs/[id]/edit`, `/dashboard/jobs/[id]/applicants`. Slugs are
generated from the title/name (reusing the current `buildUniqueId` logic in
`jobs/data.ts`), collision-suffixed, and never change after creation.

### 6.1 `profiles`
One row per authenticated user. Created automatically by a trigger on
`auth.users` insert.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | equals `auth.users.id` |
| `role` | text | `'seeker' \| 'recruiter' \| 'admin'`; **nullable** until onboarding completes |
| `full_name` | text | from signup metadata |
| `created_at` | timestamptz default now() | |

Trigger `handle_new_user()` (security definer) runs `after insert on auth.users`:
inserts `(new.id, new.raw_user_meta_data->>'full_name',
new.raw_user_meta_data->>'role')`. Google OAuth users have no `role` in metadata,
so `role` is null → the app forces them through `/onboarding` once.

`admin` is never chosen at signup. A migration-seeded table `admin_emails(email
text primary key)` plus a SQL helper `public.is_admin()` (checks
`auth.jwt() ->> 'email'` against `admin_emails`) drives admin RLS. On login the
app upgrades `profiles.role` to `'admin'` if the email is in `admin_emails`. The
owner adds their email via the seed script or the Supabase SQL editor.

### 6.2 `seeker_profiles`
| column | type | notes |
| --- | --- | --- |
| `profile_id` | uuid PK → `profiles(id)` on delete cascade | |
| `headline` | text | e.g. "Frontend engineer, 5y" |
| `location` | text | free text |
| `bio` | text | ≤ 2000 chars (app-validated) |
| `skills` | text[] | ≤ 20 tags |
| `portfolio_url` | text | nullable |
| `linkedin_url` | text | nullable |
| `github_url` | text | nullable |
| `cv_path` | text | key in the `cvs` bucket; nullable |
| `cv_filename` | text | original filename for display; nullable |
| `updated_at` | timestamptz | |

### 6.3 `companies`
One per recruiter in v1.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid → `profiles(id)` on delete cascade, **unique** | |
| `name` | text not null | |
| `slug` | text unique not null | generated from `name`, collision-suffixed |
| `tagline` | text | nullable, ≤ 120 chars |
| `description` | text | nullable, ≤ 4000 chars |
| `website` | text | nullable, URL |
| `logo_path` | text | key in `logos` bucket; nullable |
| `logo_color` | text | hex fallback swatch, as today |
| `created_at` | timestamptz default now() | |

### 6.4 `jobs`
Carries every field the current `Job` type has, plus ownership and lifecycle.

| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | text unique not null | pretty URL; generated from `title`, collision-suffixed; stable across edits |
| `company_id` | uuid → `companies(id)` on delete cascade | |
| `title` | text not null | |
| `location` | text not null | |
| `type` | text not null | `full-time \| part-time \| contract \| internship` |
| `work_mode` | text not null | `remote \| hybrid \| on-site` |
| `experience` | text not null | `junior \| mid \| senior \| lead` |
| `salary_min` | integer not null | |
| `salary_max` | integer not null | `>= salary_min` (check constraint) |
| `currency` | text not null default `'USD'` | |
| `description` | text not null | |
| `responsibilities` | text[] not null | |
| `requirements` | text[] not null | |
| `perks` | text[] not null default `'{}'` | |
| `tags` | text[] not null | |
| `apply_url` | text | **nullable**; when set, detail page links out instead of showing the apply dialog |
| `status` | text not null default `'published'` | `published \| draft \| closed` |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz | |

Indexes: `(status, created_at desc)`, `company_id`, GIN on `tags`.

### 6.5 `applications`
| column | type | notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `job_id` | uuid → `jobs(id)` on delete cascade | |
| `seeker_id` | uuid → `profiles(id)` on delete cascade | |
| `note` | text | nullable, ≤ 2000 chars |
| `cv_path` | text | snapshot of the CV key used at apply time; nullable |
| `cv_filename` | text | nullable |
| `created_at` | timestamptz default now() | |
| | | **unique `(job_id, seeker_id)`** — one application per job per seeker |

Index: `job_id`, `seeker_id`.

### 6.6 `saved_jobs`
| column | type | notes |
| --- | --- | --- |
| `seeker_id` | uuid → `profiles(id)` on delete cascade | |
| `job_id` | uuid → `jobs(id)` on delete cascade | |
| `created_at` | timestamptz default now() | |
| | | PK `(seeker_id, job_id)` |

## 7. Row-Level Security policies

| table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | any authenticated user (public display fields) | trigger only | self | `is_admin()` |
| `seeker_profiles` | public (shown on applications) | self, `role='seeker'` | self | self / `is_admin()` |
| `companies` | public | self, `role='recruiter'`, and only one (unique `owner_id`) | owner | owner / `is_admin()` |
| `jobs` | `status='published'` for everyone; **all** statuses for the owning recruiter and `is_admin()` | owner recruiter, into their own company | owner recruiter | owner / `is_admin()` |
| `applications` | the applicant (`seeker_id = auth.uid()`) **or** the recruiter who owns `job_id`'s company, **or** `is_admin()` | `seeker_id = auth.uid()` and `role='seeker'` and the job is `published` | nobody (v1) | `is_admin()` |
| `saved_jobs` | owner | owner, `role='seeker'` | — | owner |

Helper SQL functions: `is_admin()`, `current_role()` (reads `profiles.role` for
`auth.uid()`), `owns_job(job_id uuid)` (joins `jobs → companies` on
`owner_id = auth.uid()`).

## 8. Auth & onboarding

- **Sign up** (`/signup`): tab or toggle for "I'm looking for work" / "I'm
  hiring" → email + password + full name, **or** "Continue with Google".
  Email/password path stores `{ role, full_name }` in user metadata; the trigger
  copies them to `profiles`. Supabase sends a verification email; the user must
  confirm before applying/posting (browsing still works).
- **Onboarding** (`/onboarding`): shown whenever `profiles.role` is null (all
  Google sign-ups, plus any edge case). Single choice: seeker or recruiter.
  Writes `profiles.role`. Cannot be skipped; not reachable once role is set.
- **Log in** (`/login`): email + password or Google. On success, if the email is
  in `admin_emails` and `profiles.role <> 'admin'`, upgrade it.
- **OAuth callback** (`/auth/callback`): exchanges the code, then redirects to
  `next` param, or `/onboarding` if role unset, or `/dashboard`.
- **Password reset:** Supabase's built-in flow; `/auth/reset` page to set the new
  password.
- **Session:** `proxy.ts` refreshes the Supabase session cookie on every request
  (per `@supabase/ssr` guidance) and enforces route protection:
  - `/dashboard`, `/profile`, `/company`, `/dashboard/**` → require a session;
    redirect to `/login?next=…` if absent.
  - `/dashboard/**`, `/company` → require `role='recruiter'`.
  - `/profile` → require `role='seeker'`.
  - `/admin/**` → require `role='admin'`.
  - Any signed-in user with `role IS NULL` → forced to `/onboarding`.
- **Sign out:** Server Action clearing the session, redirect to `/`.

## 9. Storage

Supabase Storage buckets:

| bucket | visibility | contents | access |
| --- | --- | --- | --- |
| `cvs` | **private** | `cvs/{seeker_id}/{uuid}.{pdf\|doc\|docx}` | upload: seeker for own folder. Download: a Server Action `getCvUrl(applicationId \| seekerId)` verifies the caller is that seeker or the recruiter who owns the related job, then returns a 60-second `createSignedUrl`. |
| `logos` | public | `logos/{company_id}.{png\|jpg\|svg\|webp}` | write: owning recruiter |
| `avatars` | public | `avatars/{profile_id}.{png\|jpg\|webp}` | optional; may be deferred past v1 |

Upload constraints enforced in the Server Action **and** by bucket policy: CVs
≤ 5 MB, `application/pdf` or Word; images ≤ 2 MB.

## 10. Routes & navigation

```
PUBLIC (no auth)
  /                         landing: hero search + latest published jobs
  /jobs                     browse: search / filter / sort (published only)
  /jobs/[slug]              job detail; Apply dialog (seeker) | login redirect (guest) | external link (apply_url set)
  /companies/[slug]         company profile + its published jobs
  /login  /signup           auth
  /auth/callback  /auth/reset
  /onboarding               role picker (role IS NULL only)

SEEKER (role='seeker')
  /dashboard                "My applications" + "Saved jobs"
  /profile                  edit profile, skills, links, CV upload

RECRUITER (role='recruiter')
  /dashboard                "My jobs" grouped by status, each with applicant count
  /dashboard/jobs/new       post a job (existing form + draft/publish)
  /dashboard/jobs/[id]/edit
  /dashboard/jobs/[id]/applicants   list → detail drawer (profile, note, links, CV download)
  /company                  edit company profile + logo

ADMIN (role='admin')
  /admin                    all jobs (delete), all users (delete/ban), toggle demo data

SERVER ACTIONS (in feature folders)
  auth:         signUp, signIn, signInWithGoogle, signOut, completeOnboarding, requestPasswordReset
  profiles:     upsertSeekerProfile, uploadCv, removeCv
  companies:    upsertCompany, uploadLogo
  jobs:         createJob, updateJob, setJobStatus (publish/close/draft), deleteJob
  applications: applyToJob, getCvUrl
  saved-jobs:   saveJob, unsaveJob, mergeGuestSavedJobs
  admin:        adminDeleteJob, adminDeleteUser

ROUTE HANDLERS
  /api/jobs                 public JSON list, Supabase-backed (kept for parity/consumers)
  /api/health               tiny endpoint hit by a weekly Vercel Cron to keep the free Supabase project awake
```

The site header renders by role: guest → *Browse · Log in · Sign up*; seeker →
*Browse · Dashboard · Profile · avatar menu*; recruiter → *Browse · Dashboard ·
Post a job · Company · avatar menu*; admin also shows *Admin*.

## 11. Behaviour — every case

1. **Guest browses.** Search/filter/sort/view all work. Save → `localStorage`.
   Clicking **Apply** → `/login?next=/jobs/<slug>`; after auth, returns to the
   job and the apply dialog opens automatically.
2. **Seeker signs up.** Picks "looking for work" → verifies email (or Google →
   `/onboarding` → seeker). Nudged to complete `/profile`. Can browse
   immediately; applying requires a verified email and a profile with at least a
   headline (enforced in `applyToJob`).
3. **Seeker applies.** Apply dialog on `/jobs/[slug]`: optional note, checkbox to
   attach current CV (if uploaded). `applyToJob` inserts an `applications` row,
   snapshotting `cv_path`/`cv_filename`. Job now shows **Applied ✓**. Recruiter
   is emailed (§12).
4. **Duplicate application.** `unique (job_id, seeker_id)` rejects it;
   `applyToJob` catches the constraint error and returns "already applied"; UI
   shows **Applied ✓**.
5. **Recruiter signs up.** Picks "I'm hiring" → verifies → first-run prompt to
   create the company (`/company`, name required). Until a company exists,
   *Post a job* is disabled with a hint.
6. **Recruiter posts.** `/dashboard/jobs/new` — the current job form plus a
   *Save as draft* / *Publish* choice and an optional external `apply_url`.
   Publish → `status='published'`, live on the board instantly.
7. **Recruiter reviews applicants.** `/dashboard` lists their jobs by status with
   an applicant count. `/dashboard/jobs/[id]/applicants` → one row per applicant
   (name, headline, location, applied date); opening a row shows the full seeker
   profile, the note, links, and a **Download CV** button (signed URL via
   `getCvUrl`, recruiter-authorized by `owns_job`).
8. **Recruiter edits / closes a job.** Edit updates in place (slug unchanged).
   *Close* → `status='closed'`: removed from public board and search, still in
   the recruiter dashboard, existing applications preserved. *Reopen* →
   `published`.
9. **Seeker updates CV.** New uploads replace `seeker_profiles.cv_path`. Existing
   `applications` keep the snapshot they were submitted with — recruiters still
   download exactly what was sent.
10. **Saved-jobs sync.** Guest saves accumulate in `localStorage`. On login as a
    seeker, `mergeGuestSavedJobs(localIds)` upserts them into `saved_jobs`,
    then the client clears `localStorage` and switches to the DB-backed store.
    The `useSavedJobs` hook exposes the same API for both backends.
11. **Recruiter sets an external apply URL.** `/jobs/[slug]` shows **Apply on
    company site** (opens `apply_url`) instead of the on-site dialog; no
    `applications` row is created.
12. **Owner moderates.** `/admin` lists all jobs and users. `adminDeleteJob`
    (service role) removes a job + its applications + saved rows.
    `adminDeleteUser` deletes the auth user (cascades to `profiles` and
    everything owned). Demo data can be re-seeded or wiped from here.
13. **Account with `role IS NULL`** (Google sign-up mid-flow, abandoned
    onboarding) → every protected route and `proxy.ts` redirect to
    `/onboarding`.
14. **Recruiter account deleted while applications exist** → `on delete cascade`
    from `companies` removes the jobs and their applications; seekers see those
    entries disappear from "My applications" (acceptable in v1).

## 12. Email

One transactional template, sent from `applyToJob` after a successful insert:

- **To:** the recruiter who owns the job. Their email lives in `auth.users` and
  is not readable under the seeker's RLS, so `applyToJob` (a server action) uses
  the **service-role** Supabase client to look it up (`auth.admin.getUserById`
  on `companies.owner_id`). The `applications` insert itself still runs under the
  seeker's session so RLS enforces `seeker_id = auth.uid()`.
- **Subject:** `New applicant for <job title>`
- **Body:** applicant name + headline, truncated note, a link to
  `/dashboard/jobs/<id>/applicants`.
- Sent via Resend; failures are logged but do not fail the application (the row
  is already committed).

Supabase handles verification, password-reset, and OAuth emails with its default
templates (branding tweak optional, not required for v1).

## 13. Accepted risks / assumptions

- **No rate-limiting or CAPTCHA in v1.** Open recruiter signup + immediate
  publish means spam is possible; mitigation is the admin delete tools. A
  honeypot field on the post and signup forms is a cheap add if noise appears.
- **Resend free tier + domain:** sending to arbitrary recruiter emails needs a
  verified sending domain. Until then, `applyToJob` emails may only reach
  addresses on the Resend account. Documented in `.env.example`.
- **Supabase free-tier pause:** a weekly Vercel Cron → `/api/health` keeps the
  project warm.
- **Single region:** Supabase + Vercel default regions; no multi-region concerns
  at this scale.
- **CV virus scanning:** out of scope; type/size checks only.

## 14. Codebase impact

Keep the feature-based layout, the entire `components/ui` kit, and the visual
design system unchanged.

**Rewritten**
- `src/features/jobs/data.ts` — `fs` → Supabase queries. `getJobs(filters)` and
  `getJobBySlug(slug)` (renamed from `getJobById`) keep their return shapes;
  add `createJob`, `updateJob`, `setJobStatus`, `deleteJob`, all owner-scoped.
- `src/features/jobs/types.ts` — `Job` gains `companyId`, `slug`, `status`;
  `company` becomes a joined `{ name, slug, logoPath, logoColor }`.
- `src/features/saved-jobs/*` — add a DB-backed store for authenticated seekers
  behind the existing `useSavedJobs` interface; keep the `localStorage` store
  for guests; add the merge-on-login path.
- `src/app/layout.tsx` / `site-header.tsx` — role-aware nav; read the session in
  a Server Component.
- `src/app/jobs/create/page.tsx` → moves under `/dashboard/jobs/new`, gated to
  recruiters, wired to `createJob` + draft/publish.

**New**
- `src/lib/supabase/{server,client,middleware}.ts` — `@supabase/ssr` factories.
- `proxy.ts` — session refresh + route protection.
- `src/features/auth/*` — pages, forms, server actions, `getSession`/`getProfile`
  helpers.
- `src/features/profiles/*` — seeker profile page, form, CV upload.
- `src/features/companies/*` — company page/edit, logo upload, public
  `/companies/[slug]`.
- `src/features/applications/*` — apply dialog, applicants list + drawer,
  `applyToJob`, `getCvUrl`.
- `src/features/admin/*` — admin page + actions.
- `supabase/migrations/*.sql` — schema, RLS, functions, triggers.
- `scripts/seed.ts` — inserts the "Perch Demo" company + the 14 jobs from the
  current `seed.ts`, plus the owner's email into `admin_emails`.

**Removed**
- `src/features/jobs/data.ts` filesystem code, `data/jobs.json`, the runtime
  seeding in `data.ts`. `src/features/jobs/seed.ts` is repurposed as the source
  array for `scripts/seed.ts`.

## 15. Delivery phases

Each phase ends deployable.

1. **Supabase swap.** Create the Supabase project; one migration for the **full
   schema** (all tables in §6), helper functions (§7), the `auth.users` trigger,
   and storage buckets — but with only **public-read RLS** wired up for now
   (`jobs` where `status='published'`, `companies`, `seeker_profiles`).
   `@supabase/ssr` clients; rewrite `jobs/data.ts` reads; `scripts/seed.ts` loads
   the demo company + 14 jobs and the owner's `admin_emails` row; deploy to
   Vercel with env vars; weekly health cron.
   **Done when:** the public site is live on a Vercel URL; browsing / search /
   detail / company pages all read from Postgres. Auth and posting are not yet
   exposed.
2. **Auth, roles, profiles.** Signup / login / onboarding / callback / reset
   pages and their server actions; `admin_emails` → `role='admin'` upgrade on
   login; `proxy.ts` session refresh + route protection; the write-side RLS for
   `profiles`, `seeker_profiles`, `companies` (self/owner); seeker `/profile` +
   CV upload (`cvs` bucket); recruiter `/company` + logo (`logos` bucket);
   role-aware header; public `/companies/[slug]`.
   **Done when:** users can register as seeker or recruiter, verify, log in, and
   edit their profile / company; protected routes enforce role.
3. **Recruiter posting.** Owner-write RLS for `jobs`; `/dashboard` (my jobs by
   status + counts placeholder); `/dashboard/jobs/new` + `/dashboard/jobs/[id]/edit`;
   `createJob` / `updateJob` / `setJobStatus`; draft / publish / close / reopen.
   **Done when:** a recruiter can publish a job from the dashboard and see it on
   the public board, then edit and close it.
4. **Applications.** Write-side RLS for `applications` (seeker-insert, seeker/
   owner-read; the unique `(job_id, seeker_id)` constraint is already in the
   schema); apply dialog on `/jobs/[slug]` with the guest login-redirect;
   `applyToJob` + `getCvUrl`; seeker `/dashboard` "My applications";
   `/dashboard/jobs/[id]/applicants` list + detail drawer + CV download; Resend
   "new applicant" email (service-role recipient lookup, §12).
   **Done when:** a seeker can apply once per job and the recruiter can see the
   applicant and download the CV; the recruiter gets an email.
5. **Saved-jobs sync + admin + polish.** Write-side RLS for `saved_jobs`;
   DB-backed `useSavedJobs` for authenticated seekers + `mergeGuestSavedJobs` on
   login; `/admin` page + `adminDeleteJob` / `adminDeleteUser`; empty states,
   loading / error boundaries for the new routes, metadata, accessibility pass.
   **Done when:** saved jobs follow a logged-in seeker across devices; the owner
   can delete jobs and users; the new surfaces match the existing polish.

## 16. Open questions

None blocking. Deferred choices (avatar bucket, Supabase email-template
branding, honeypot fields) are noted inline and can be decided during their
phase.
