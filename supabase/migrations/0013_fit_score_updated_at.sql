-- ============================================================================
-- job_fit_scores.updated_at — the column the daily scoring cap counts on.
--
-- `created_at` records the first time a (seeker, job) pair was scored and then
-- never moves, because a re-score upserts the existing row. That makes it
-- useless for metering: a seeker who re-scores the same jobs all day looks
-- idle. `updated_at` is written explicitly on every upsert in `getFitScore`,
-- so counting rows above a cutoff counts actual model calls.
--
-- Backfilled from created_at rather than now(), so existing rows don't all land
-- in the current window and lock their owners out of a feature they haven't
-- used yet.
-- ============================================================================

alter table public.job_fit_scores
  add column if not exists updated_at timestamptz not null default now();

update public.job_fit_scores
  set updated_at = created_at
  where updated_at > created_at;

create index if not exists job_fit_scores_seeker_updated_idx
  on public.job_fit_scores (seeker_id, updated_at desc);
