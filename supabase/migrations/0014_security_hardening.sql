-- ============================================================================
-- Perch — pre-launch security hardening.
--
-- Four database-side fixes. Each one closes a hole that app code alone could
-- not, because the anon key lets anybody talk to PostgREST and GoTrue directly:
-- a guard that lives only in a server action is a guard an attacker skips.
--
--   1. self-service admin signup
--   2. admins left over after removal from admin_emails
--   3. seekers resetting their own AI fit-score quota
--   4. uploads with no size or type ceiling
--
-- Re-runnable: create or replace / drop if exists / idempotent updates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. handle_new_user — never trust a role out of user metadata.
--
-- raw_user_meta_data is whatever the client passed to auth.signUp, and the
-- profiles.role check constraint happens to allow 'admin'. So
-- `signUp({ options: { data: { role: 'admin' } } })` against the public anon key
-- minted an admin, and requireRole('admin') believed it. The signUp server
-- action validates the role, but nothing forces anyone to go through it.
--
-- Only the two self-service roles survive now. Anything else — 'admin', a typo,
-- a crafted string — lands as NULL, which routes the user into /onboarding and
-- lets them pick a legitimate role. Admin is granted by admin_emails alone.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when requested_role in ('seeker', 'recruiter') then requested_role
      else null
    end
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Demote anyone already holding admin without being in admin_emails.
--
-- Cleans up accounts minted through the hole above, and any admin dropped from
-- admin_emails while their profile kept the role. NULL rather than 'seeker', so
-- onboarding asks them instead of this migration guessing.
--
-- The 0003 role-immutability trigger lets `postgres` through, so a migration
-- can write this; a normal authenticated caller still cannot.
-- ----------------------------------------------------------------------------
update public.profiles p
   set role = null
 where p.role = 'admin'
   and not exists (
     select 1
       from auth.users u
       join public.admin_emails ae
         on lower(ae.email) = lower(u.email)
      where u.id = p.id
   );

-- ----------------------------------------------------------------------------
-- 3. job_fit_scores — readable by its seeker, writable only by the server.
--
-- The 0010 policy was `for all`, so the row that records a seeker's usage was
-- editable by that same seeker. Deleting the rows, or backdating updated_at,
-- reset the 50-per-day counter in getFitScore and bought unlimited paid model
-- calls. A quota the quota-holder can rewrite is not a quota.
--
-- Reads stay open to the owner (the card needs the cached score). Writes now
-- happen only through the service-role client in getFitScore, which sets
-- seeker_id from the verified session.
-- ----------------------------------------------------------------------------
drop policy if exists "job_fit_scores owned by seeker" on public.job_fit_scores;
drop policy if exists "job_fit_scores readable by seeker" on public.job_fit_scores;
create policy "job_fit_scores readable by seeker"
  on public.job_fit_scores for select to authenticated
  using (seeker_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Storage ceilings at the bucket, not just in the upload component.
--
-- The 5 MB / PDF / image checks lived in cv-upload.tsx and logo-upload.tsx.
-- Clients upload straight to Storage with the anon key, so those checks are a
-- courtesy to honest users and nothing more. These mirror the component
-- constants exactly:
--   cvs    — CV_MAX_BYTES + CV_ACCEPT   (profiles/schema.ts)
--   logos  — LOGO_MAX_BYTES + EXT_BY_TYPE (companies/components/logo-upload.tsx)
--   avatars— same ceiling as logos; no uploader ships yet, so the bucket is
--            locked down before one does.
--
-- SVG is allowed because the logo uploader accepts it; next.config.ts serves
-- images under `script-src 'none'; sandbox` with an attachment disposition,
-- which is what makes that safe.
-- ----------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 where id = 'cvs';

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/svg+xml'
       ]
 where id in ('logos', 'avatars');
