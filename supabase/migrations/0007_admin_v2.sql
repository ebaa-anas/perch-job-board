-- ============================================================================
-- Perch Phase 6 — admin console v2: company suspension, user reports, audit log,
-- self-service admin management.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Company suspension ("revoke from posting")
-- ----------------------------------------------------------------------------
alter table public.companies
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

create or replace function public.company_suspended(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = target and c.suspended_at is not null
  );
$$;

-- Public board hides a suspended company's jobs; the owner still sees them, and
-- so does an admin.
drop policy if exists "jobs are publicly readable when published" on public.jobs;
create policy "jobs are publicly readable when published"
  on public.jobs for select
  using (
    (status = 'published' and not public.company_suspended(company_id))
    or public.owns_job(id)
    or public.is_admin()
  );

-- A suspended company can't create jobs...
drop policy if exists "jobs insert by company owner" on public.jobs;
create policy "jobs insert by company owner"
  on public.jobs for insert to authenticated
  with check (
    public.owns_company(company_id)
    and public.current_user_role() = 'recruiter'
    and not public.company_suspended(company_id)
  );

-- ...nor publish/reopen one (editing a draft or closed role is still allowed).
drop policy if exists "jobs update by owner or admin" on public.jobs;
create policy "jobs update by owner or admin"
  on public.jobs for update to authenticated
  using (public.owns_job(id) or public.is_admin())
  with check (
    (public.owns_company(company_id) or public.is_admin())
    and (
      status <> 'published'
      or public.is_admin()
      or not public.company_suspended(company_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 2. company_reports — a signed-in user flags a company
-- ----------------------------------------------------------------------------
create table if not exists public.company_reports (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'misleading', 'inappropriate', 'scam', 'other')),
  detail      text,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (company_id, reporter_id)
);

create index if not exists company_reports_company_idx on public.company_reports (company_id);
create index if not exists company_reports_status_idx on public.company_reports (status);

alter table public.company_reports enable row level security;

drop policy if exists "company_reports insert by reporter" on public.company_reports;
create policy "company_reports insert by reporter"
  on public.company_reports for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "company_reports read own or admin" on public.company_reports;
create policy "company_reports read own or admin"
  on public.company_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "company_reports update by admin" on public.company_reports;
create policy "company_reports update by admin"
  on public.company_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "company_reports delete by admin" on public.company_reports;
create policy "company_reports delete by admin"
  on public.company_reports for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. admin_audit_log — record of admin actions
-- ----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit read by admin" on public.admin_audit_log;
create policy "admin_audit read by admin"
  on public.admin_audit_log for select to authenticated
  using (public.is_admin());

drop policy if exists "admin_audit insert by admin" on public.admin_audit_log;
create policy "admin_audit insert by admin"
  on public.admin_audit_log for insert to authenticated
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. admin_emails — let an admin manage the allow-list from Settings
--    (is_admin() is SECURITY DEFINER, so no recursion when it reads this table)
-- ----------------------------------------------------------------------------
drop policy if exists "admin_emails manage by admin" on public.admin_emails;
create policy "admin_emails manage by admin"
  on public.admin_emails for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
