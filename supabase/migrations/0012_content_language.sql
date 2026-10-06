-- ============================================================================
-- Perch Phase 10 — Turkish support: tag job/company content by language.
-- Recruiters write in whichever language they choose; Perch never translates
-- their content. This column just lets seekers filter jobs by a language they
-- can read.
-- ============================================================================

alter table public.jobs
  add column if not exists language text not null default 'en'
    check (language in ('en', 'tr'));

alter table public.companies
  add column if not exists language text not null default 'en'
    check (language in ('en', 'tr'));

create index if not exists jobs_language_idx on public.jobs (language);
