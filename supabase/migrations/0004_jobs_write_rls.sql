-- ============================================================================
-- Perch Phase 3 — owner-write RLS for jobs.
--
-- 0001 already gives jobs a SELECT policy that includes `owns_job(id)` and
-- `is_admin()`, so a recruiter can already read their own drafts/closed roles.
-- This migration adds INSERT / UPDATE / DELETE, scoped to the recruiter who
-- owns the job's company (or an admin).
-- ============================================================================

-- Does the caller own this company? SECURITY DEFINER + pinned search_path to
-- match the other helpers in 0001. `companies` is publicly readable so there is
-- no recursion risk.
create or replace function public.owns_company(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = target and c.owner_id = auth.uid()
  );
$$;

drop policy if exists "jobs insert by company owner" on public.jobs;
create policy "jobs insert by company owner"
  on public.jobs for insert to authenticated
  with check (
    public.owns_company(company_id)
    and public.current_user_role() = 'recruiter'
  );

drop policy if exists "jobs update by owner or admin" on public.jobs;
create policy "jobs update by owner or admin"
  on public.jobs for update to authenticated
  using (public.owns_job(id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());

drop policy if exists "jobs delete by owner or admin" on public.jobs;
create policy "jobs delete by owner or admin"
  on public.jobs for delete to authenticated
  using (public.owns_job(id) or public.is_admin());
