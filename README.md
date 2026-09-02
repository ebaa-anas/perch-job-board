# Perch — a scalable job board

A modern job board built with the Next.js App Router. Browse and filter roles,
open a detail view, shortlist jobs on your device, and post new openings through
a validated form.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with light/dark theming (no flash of wrong theme)
- **React Hook Form + Zod** for the "Post a job" form
- **lucide-react** icons
- File-backed data layer (`data/jobs.json`), seeded from code on first run

## Features

| Feature | Where |
| --- | --- |
| Browse jobs | `/jobs` — Server Component reads the data layer directly |
| Search & filter | `JobFilters` (Client) drives URL search params; the page re-renders server-side |
| View job details | `/jobs/[id]` — dynamic route, `notFound()` for missing ids |
| Save jobs | `SavedJobsProvider` (Client) persists ids in `localStorage`, syncs across tabs |
| Post a new job | `/jobs/create` → `JobForm` (RHF + Zod) → `POST /api/jobs` |
| Loading & error states | `loading.tsx` / `error.tsx` / `not-found.tsx` under `app/jobs` |

## Routes

```
/                     Landing page with hero search + latest roles
/jobs                 Browse, search, filter, sort (reads ?q, ?type, ?mode, ?level, ?minSalary, ?sort)
/jobs/[id]            Job detail
/jobs/create          Post a new job
/saved-jobs           Your shortlist (client-side, per device)

/api/jobs             GET (list, same query params) · POST (create, Zod-validated)
/api/jobs/[id]        GET one job (404 if missing)
```

## Architecture

Feature-based. Route files stay thin; everything reusable lives under `src/features/*`.

```
src/
  app/                     Routing only — pages, layouts, loading/error, route handlers
  components/
    ui/                    Design-system primitives (Button, Input, Card, Badge, …)
    layout/                Site header / footer / theme toggle
    theme-provider.tsx
  features/
    jobs/
      components/          JobCard, JobList, JobFilters, JobDetail, JobForm, …
      data.ts             Server-only read/write over data/jobs.json (React.cache + write queue)
      schema.ts           Zod schemas: form + API contract
      types.ts            Job model and enums
      utils.ts            Formatting, filter/sort, search-param parsing
      seed.ts             Initial dataset
    saved-jobs/
      saved-jobs-provider.tsx   Context + localStorage
      storage.ts
      components/               SaveJobButton, SavedJobsList
  lib/
    utils.ts              cn() helper
```

**Server vs client split**

- Server Components fetch data (home, `/jobs`, `/jobs/[id]`, `/saved-jobs`) via the
  `data.ts` layer — no client JS for the list itself.
- Client Components are the interactive edges only: filters, theme toggle, save
  button, the create form, the header.

**Data layer** — Data lives in Supabase. For local dev, run `npx supabase start`
then `npm run db:reset && npm run seed`. See `docs/DEPLOYMENT.md` for production.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm run start   # production
npm run lint                      # eslint
npx tsc --noEmit                  # type check
```
