-- ============================================================================
-- Perch Phase 5 — write-side RLS for `saved_jobs`.
--
-- `saved_jobs` (0001): primary key (seeker_id, job_id). A seeker manages only
-- their own rows. Admin moderation of jobs / companies / profiles / applications
-- is already covered by the "... or is_admin()" clauses added in 0002 / 0004 /
-- 0005; deleting an auth user is done server-side with the service role.
-- ============================================================================

drop policy if exists "saved_jobs select own" on public.saved_jobs;
create policy "saved_jobs select own"
  on public.saved_jobs for select to authenticated
  using (seeker_id = auth.uid());

drop policy if exists "saved_jobs insert own" on public.saved_jobs;
create policy "saved_jobs insert own"
  on public.saved_jobs for insert to authenticated
  with check (
    seeker_id = auth.uid()
    and public.current_user_role() = 'seeker'
  );

drop policy if exists "saved_jobs delete own" on public.saved_jobs;
create policy "saved_jobs delete own"
  on public.saved_jobs for delete to authenticated
  using (seeker_id = auth.uid());
