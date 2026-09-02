-- ============================================================================
-- Perch Phase 4 — write-side RLS for `applications`.
--
-- `applications` (0001): unique (job_id, seeker_id); columns snapshot the CV
-- (cv_path / cv_filename) at submit time.
--
--   SELECT  — the applicant, the recruiter who owns the job, or an admin.
--   INSERT  — the applicant themselves (role='seeker'), only onto a currently
--             published job. cv_path, if given, must be in the seeker's folder.
--   DELETE  — the applicant (withdraw) or an admin.
--   UPDATE  — nobody. A submitted application is immutable (case 9: recruiters
--             download exactly what was sent).
-- ============================================================================

drop policy if exists "applications readable by applicant or job owner" on public.applications;
create policy "applications readable by applicant or job owner"
  on public.applications for select to authenticated
  using (
    seeker_id = auth.uid()
    or public.owns_job(job_id)
    or public.is_admin()
  );

drop policy if exists "applications insert by seeker for published job" on public.applications;
create policy "applications insert by seeker for published job"
  on public.applications for insert to authenticated
  with check (
    seeker_id = auth.uid()
    and public.current_user_role() = 'seeker'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status = 'published'
    )
    and (
      cv_path is null
      or (storage.foldername(cv_path))[1] = auth.uid()::text
    )
  );

drop policy if exists "applications delete by applicant or admin" on public.applications;
create policy "applications delete by applicant or admin"
  on public.applications for delete to authenticated
  using (seeker_id = auth.uid() or public.is_admin());
