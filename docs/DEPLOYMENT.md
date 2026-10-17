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

## 5. Portfolio demo mode (optional)

Adds one-click "Try the demo" sign-in on `/login`, a banner on demo accounts,
and a daily reset of the demo data. Off unless switched on.

1. Apply migration `0023` with `npm run db:push`. It stops the shared demo
   logins from changing their email address or ever becoming admins.
2. In Vercel → Settings → Environment Variables (Production), add:
   - `NEXT_PUBLIC_DEMO_MODE` = `true`. Inlined at build time, so redeploy
     after changing it.
   - `DEMO_SEEKER_PASSWORD` and `DEMO_RECRUITER_PASSWORD`: long random values.
     Nobody types them; the sign-in action reads them on the server. Never
     give them a `NEXT_PUBLIC_` prefix.
   - `CRON_SECRET`: a long random value, if it is not set already.
3. Redeploy, then run `npm run demo:reset` once against the same Supabase
   project, or wait for the first scheduled reset (`/api/cron/demo-reset`,
   daily around 03:00 UTC; Hobby crons fire within the hour).

To generate a value:
`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.

If the passwords in your `.env.local` differ from the ones in Vercel, nothing
breaks: the first demo sign-in on the live site resets the account to the
password the deployment has.
