-- Restore the real jobs INSERT policy (0007) after local diagnostics, and drop
-- the throwaway diagnostic function.
drop function if exists public.__diag_jobs_policies();

drop policy if exists "jobs insert by company owner" on public.jobs;
create policy "jobs insert by company owner"
  on public.jobs for insert to authenticated
  with check (
    public.owns_company(company_id)
    and public.current_user_role() = 'recruiter'
    and not public.company_suspended(company_id)
  );
