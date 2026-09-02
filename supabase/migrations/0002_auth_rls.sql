-- ============================================================================
-- Perch Phase 2 — write-side RLS + storage owner-folder policies.
--
-- Builds on 0001_init.sql, which already:
--   * created the 7 tables with RLS enabled + the public-read SELECT policies,
--   * created helper fns public.is_admin() / public.current_user_role(),
--   * created buckets cvs (private), logos (public), avatars (public).
--
-- This migration only ADDS write-side policies. Every `create policy` is
-- preceded by `drop policy if exists` so the file is safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — a user may edit only their own row; only admins may delete.
-- (Row creation happens in the handle_new_user trigger, which is SECURITY
--  DEFINER and therefore bypasses RLS — no INSERT policy needed.)
-- ----------------------------------------------------------------------------
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles delete by admin" on public.profiles;
create policy "profiles delete by admin"
  on public.profiles for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- seeker_profiles — owner-managed; a seeker creates/edits their own row,
-- owner or admin may delete.
-- ----------------------------------------------------------------------------
drop policy if exists "seeker_profiles insert own" on public.seeker_profiles;
create policy "seeker_profiles insert own"
  on public.seeker_profiles for insert
  with check (profile_id = auth.uid() and public.current_user_role() = 'seeker');

drop policy if exists "seeker_profiles update own" on public.seeker_profiles;
create policy "seeker_profiles update own"
  on public.seeker_profiles for update
  using (profile_id = auth.uid());

drop policy if exists "seeker_profiles delete own or admin" on public.seeker_profiles;
create policy "seeker_profiles delete own or admin"
  on public.seeker_profiles for delete
  using (profile_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- companies — one row per recruiter (owner_id is unique in 0001); the owner
-- manages it, owner or admin may delete.
-- ----------------------------------------------------------------------------
drop policy if exists "companies insert own" on public.companies;
create policy "companies insert own"
  on public.companies for insert
  with check (owner_id = auth.uid() and public.current_user_role() = 'recruiter');

drop policy if exists "companies update own" on public.companies;
create policy "companies update own"
  on public.companies for update
  using (owner_id = auth.uid());

drop policy if exists "companies delete own or admin" on public.companies;
create policy "companies delete own or admin"
  on public.companies for delete
  using (owner_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- storage.objects — owner-folder convention: object path is {uid}/{file}
-- inside each bucket, i.e. (storage.foldername(name))[1] = the owner's uid.
--
-- Policy names are "Perch <bucket> owner <op>" to avoid colliding with any
-- Supabase-generated default policy on storage.objects.
--
--   * cvs     — private bucket. INSERT/UPDATE/DELETE only; NO SELECT policy
--               (downloads happen through server-minted signed URLs).
--   * logos   — public bucket. SELECT is already granted by the bucket being
--               public; we add owner-scoped write policies.
--   * avatars — same as logos.
-- ----------------------------------------------------------------------------

-- cvs (private) -------------------------------------------------------------
drop policy if exists "Perch cvs owner insert" on storage.objects;
create policy "Perch cvs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch cvs owner update" on storage.objects;
create policy "Perch cvs owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch cvs owner delete" on storage.objects;
create policy "Perch cvs owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- logos (public read via bucket) ------------------------------------------
drop policy if exists "Perch logos owner insert" on storage.objects;
create policy "Perch logos owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch logos owner update" on storage.objects;
create policy "Perch logos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch logos owner delete" on storage.objects;
create policy "Perch logos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- avatars (public read via bucket) --------------------------------------
drop policy if exists "Perch avatars owner insert" on storage.objects;
create policy "Perch avatars owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch avatars owner update" on storage.objects;
create policy "Perch avatars owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Perch avatars owner delete" on storage.objects;
create policy "Perch avatars owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
