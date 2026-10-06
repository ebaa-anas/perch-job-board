-- ============================================================================
-- Perch Phase 9 — per-job custom application questions; retire external-apply.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. job_application_questions — recruiter-authored questions for one job.
--    Read follows the same visibility as the job itself (published, or the
--    owner/admin); write is owner or admin only, same as `jobs` itself.
-- ----------------------------------------------------------------------------
create table if not exists public.job_application_questions (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  label      text not null,
  type       text not null check (type in ('short_text', 'long_text', 'yes_no', 'multiple_choice')),
  options    text[] not null default '{}',
  required   boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists job_application_questions_job_idx
  on public.job_application_questions (job_id, position);

alter table public.job_application_questions enable row level security;

drop policy if exists "job_application_questions readable when job is visible" on public.job_application_questions;
create policy "job_application_questions readable when job is visible"
  on public.job_application_questions for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (j.status = 'published' or public.owns_job(j.id) or public.is_admin())
    )
  );

drop policy if exists "job_application_questions written by owner or admin" on public.job_application_questions;
create policy "job_application_questions written by owner or admin"
  on public.job_application_questions for all to authenticated
  using (public.owns_job(job_id) or public.is_admin())
  with check (public.owns_job(job_id) or public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. applications.custom_answers — a self-contained snapshot of the answers
--    the seeker gave, taken at apply time: [{ questionId, label, type, answer }].
--    Snapshotting (rather than joining job_application_questions by id) means
--    a later edit to the job's questions never changes what a past applicant
--    is shown as having answered.
-- ----------------------------------------------------------------------------
alter table public.applications
  add column if not exists custom_answers jsonb not null default '[]'::jsonb;
