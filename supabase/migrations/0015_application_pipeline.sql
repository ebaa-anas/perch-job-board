-- ============================================================================
-- Perch Phase 10 — the hiring pipeline: stages, internal notes, and a
-- candidate-visible timeline.
--
-- Why new tables instead of columns on `applications`: migration 0005 makes a
-- submitted application immutable on purpose ("recruiters download exactly
-- what was sent"), and RLS cannot restrict an UPDATE to a subset of columns.
-- Adding a mutable `stage` there would mean granting UPDATE on the whole row.
-- So mutable recruiter state lives in `application_pipeline`, and every change
-- is appended to `application_events`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. owns_application(uuid) — the `owns_job` equivalent one level down, so the
--    policies below stay readable. Security definer for the same reason as
--    `owns_job`: the joins must not re-enter RLS.
-- ----------------------------------------------------------------------------
create or replace function public.owns_application(target_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j      on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.id = target_application and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_application_applicant(target_application uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    where a.id = target_application and a.seeker_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. application_pipeline — exactly one row per application, created by
--    trigger so an application can never exist without a stage.
--
--    `decided_at` is stamped the first time the row leaves 'applied'. It is
--    what the public "responds to applicants" figure on a company profile is
--    computed from, and what time-to-first-response reporting will use.
-- ----------------------------------------------------------------------------
create table if not exists public.application_pipeline (
  application_id uuid primary key references public.applications (id) on delete cascade,
  stage          text not null default 'applied'
    check (stage in ('applied', 'reviewed', 'shortlisted', 'interview', 'offer', 'hired', 'rejected')),
  rating         smallint check (rating between 1 and 5),
  decided_at     timestamptz,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);

create index if not exists application_pipeline_stage_idx
  on public.application_pipeline (stage);

alter table public.application_pipeline enable row level security;

drop policy if exists "application_pipeline readable by applicant or job owner" on public.application_pipeline;
create policy "application_pipeline readable by applicant or job owner"
  on public.application_pipeline for select to authenticated
  using (
    public.is_application_applicant(application_id)
    or public.owns_application(application_id)
    or public.is_admin()
  );

-- The trigger below is security definer and so bypasses this; the policy exists
-- for the backfill/repair case where a recruiter's own row went missing.
drop policy if exists "application_pipeline insert by job owner" on public.application_pipeline;
create policy "application_pipeline insert by job owner"
  on public.application_pipeline for insert to authenticated
  with check (public.owns_application(application_id) or public.is_admin());

drop policy if exists "application_pipeline update by job owner" on public.application_pipeline;
create policy "application_pipeline update by job owner"
  on public.application_pipeline for update to authenticated
  using (public.owns_application(application_id) or public.is_admin())
  with check (public.owns_application(application_id) or public.is_admin());

-- No DELETE policy: the row dies with its application, via the cascade.

-- ----------------------------------------------------------------------------
-- 3. application_events — append-only history.
--
--    `visibility` is the hinge between the two sides of the product:
--      'internal' — recruiter triage notes, never shown to the candidate;
--      'seeker'   — the timeline the candidate sees on their dashboard.
--    Stage changes are written as 'seeker' so the candidate always learns the
--    outcome; that transparency is the point of the feature.
-- ----------------------------------------------------------------------------
create table if not exists public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  actor_id       uuid references public.profiles (id) on delete set null,
  kind           text not null check (kind in ('stage_change', 'note')),
  from_stage     text,
  to_stage       text,
  body           text,
  visibility     text not null default 'internal' check (visibility in ('internal', 'seeker')),
  created_at     timestamptz not null default now()
);

create index if not exists application_events_application_idx
  on public.application_events (application_id, created_at desc);

alter table public.application_events enable row level security;

drop policy if exists "application_events readable by owner, or applicant when shared" on public.application_events;
create policy "application_events readable by owner, or applicant when shared"
  on public.application_events for select to authenticated
  using (
    public.owns_application(application_id)
    or public.is_admin()
    or (visibility = 'seeker' and public.is_application_applicant(application_id))
  );

drop policy if exists "application_events appended by job owner" on public.application_events;
create policy "application_events appended by job owner"
  on public.application_events for insert to authenticated
  with check (
    (public.owns_application(application_id) or public.is_admin())
    and actor_id = auth.uid()
  );

-- Deliberately no UPDATE or DELETE policy: this table is the audit trail for
-- decisions taken about a person's job application, so it is append-only.
-- Erasure happens by deleting the application (cascade), which is what a
-- KVKK/GDPR deletion request does.

-- ----------------------------------------------------------------------------
-- 4. Seed a pipeline row for every application, past and future.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.application_pipeline (application_id)
  values (new.id)
  on conflict (application_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_application_created on public.applications;
create trigger on_application_created
  after insert on public.applications
  for each row execute function public.handle_new_application();

insert into public.application_pipeline (application_id)
select a.id from public.applications a
on conflict (application_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. company_response_rates — the public ghosting metric, as a view so the
--    aggregate can be read without exposing a single application row.
--    `security_invoker = off` (the default for views) keeps it readable by the
--    service-role client that renders public company pages.
-- ----------------------------------------------------------------------------
create or replace view public.company_response_rates as
select
  c.id                                                     as company_id,
  count(p.application_id)                                   as total_applications,
  count(p.application_id) filter (where p.stage <> 'applied') as responded_applications
from public.companies c
  join public.jobs j                 on j.company_id = c.id
  join public.applications a         on a.job_id = j.id
  join public.application_pipeline p on p.application_id = a.id
group by c.id;

revoke all on public.company_response_rates from anon, authenticated;
