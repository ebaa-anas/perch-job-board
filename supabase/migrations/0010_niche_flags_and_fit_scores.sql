-- ============================================================================
-- Perch Phase 8 — entry-level niche flags + AI fit-score cache.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. jobs — two candidate-facing niche flags recruiters set on post/edit.
-- ----------------------------------------------------------------------------
alter table public.jobs
  add column if not exists no_experience_required boolean not null default false;
alter table public.jobs
  add column if not exists visa_sponsorship boolean not null default false;

create index if not exists jobs_no_experience_idx
  on public.jobs (no_experience_required) where no_experience_required;
create index if not exists jobs_visa_sponsorship_idx
  on public.jobs (visa_sponsorship) where visa_sponsorship;

-- ----------------------------------------------------------------------------
-- 2. job_fit_scores — cached AI-generated match between a seeker and a job.
--    `input_hash` fingerprints the seeker profile + job fields that went into
--    the score, so an edited profile or job invalidates the cache without a
--    background job: a mismatched hash is just treated as a cache miss.
-- ----------------------------------------------------------------------------
create table if not exists public.job_fit_scores (
  seeker_id  uuid not null references public.profiles (id) on delete cascade,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  input_hash text not null,
  score      smallint not null check (score between 0 and 100),
  summary    text not null,
  strengths  text[] not null default '{}',
  gaps       text[] not null default '{}',
  created_at timestamptz not null default now(),
  -- Bumped on every (re)scoring, unlike created_at, which stays at the first.
  -- `getFitScore` counts recent rows by this column to cap how many paid model
  -- calls one seeker can trigger per day.
  updated_at timestamptz not null default now(),
  primary key (seeker_id, job_id)
);

create index if not exists job_fit_scores_seeker_updated_idx
  on public.job_fit_scores (seeker_id, updated_at desc);

alter table public.job_fit_scores enable row level security;

drop policy if exists "job_fit_scores owned by seeker" on public.job_fit_scores;
create policy "job_fit_scores owned by seeker"
  on public.job_fit_scores for all to authenticated
  using (seeker_id = auth.uid())
  with check (seeker_id = auth.uid());
