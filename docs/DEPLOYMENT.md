# Deploying Perch

**Note:** The Supabase project (`perch`, ref: `gqmeyzobgehsbuglkvwh`) is already created and linked. You can skip to pushing schema changes.

## 1. Schema & Seeding

1. Push the schema to the hosted Supabase: `npm run db:push`.
2. Seed the database: set `.env.local` to the hosted Supabase URL/keys temporarily, then run `SEED_ADMIN_EMAIL=you@example.com npm run seed`. Revert `.env.local` to local values after.
3. Storage: buckets `cvs`, `logos`, `avatars` already exist from the migration.

## 2. GitHub

`git remote add origin <your repo>` && `git push -u origin main`.

## 3. Vercel

1. vercel.com → New Project → import the repo. Framework: Next.js (auto).
2. Environment Variables — add all of `.env.example` with real values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (your Vercel URL).
   Leave `RESEND_*` blank until Phase 4.
3. Deploy. Visit the URL — the board should list the seeded jobs.
4. The `vercel.json` cron keeps the free Supabase project awake.

## 4. Every later deploy

`git push` → Vercel auto-builds. Schema changes: `npm run db:push` first.
