-- ============================================================================
-- Perch Phase 12 — job view counters, the top of the recruiter funnel.
--
-- Recruiters could see how many people applied but not how many saw the post,
-- so "12 applicants" was unreadable: good ad, bad listing, or no traffic at
-- all? This table supplies the denominator.
--
-- Stored as one row per (job, day) and incremented, not one row per event.
-- A job board's view volume is its largest write stream by far, and nothing
-- in the product needs an individual view — only totals and a daily series.
-- That keeps the table small enough to never need pruning.
-- ============================================================================

create table if not exists public.job_views (
  job_id uuid not null references public.jobs (id) on delete cascade,
  day    date not null default (now() at time zone 'utc')::date,
  views  integer not null default 0,
  primary key (job_id, day)
);

create index if not exists job_views_day_idx on public.job_views (day desc);

alter table public.job_views enable row level security;

-- Readable by the job's team (membership-based since 0018) and by admins.
-- Not public: view counts are competitive information between employers.
drop policy if exists "job_views readable by job team" on public.job_views;
create policy "job_views readable by job team"
  on public.job_views for select to authenticated
  using (public.owns_job(job_id) or public.is_admin());

-- No INSERT/UPDATE policy: counting happens only through the function below,
-- so a visitor cannot write an arbitrary number into a competitor's row.

/**
 * Count one view of a published job.
 *
 * Security definer so an anonymous visitor can be counted without any write
 * privilege on the table. Deliberately narrow:
 *   * only `published` jobs are counted — a draft has no audience;
 *   * the job's own team is not counted, so a recruiter refreshing their post
 *     does not inflate the denominator they are judged by;
 *   * it returns void and swallows nothing, so a failure surfaces in logs
 *     rather than breaking the page it was called from.
 */
create or replace function public.record_job_view(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.jobs j where j.id = p_job and j.status = 'published'
  ) then
    return;
  end if;

  -- Skip the hiring team's own traffic.
  if public.owns_job(p_job) then
    return;
  end if;

  insert into public.job_views (job_id, day, views)
  values (p_job, (now() at time zone 'utc')::date, 1)
  on conflict (job_id, day)
  -- The existing row is addressed by the table's bare name here; a
  -- schema-qualified reference is not the documented form for
  -- ON CONFLICT DO UPDATE.
  do update set views = job_views.views + 1;
end;
$$;

revoke all on function public.record_job_view(uuid) from public;
grant execute on function public.record_job_view(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- job_view_totals — one number per job, so the funnel page does not have to
-- sum a daily series client-side for every row it renders.
-- ----------------------------------------------------------------------------
-- `security_invoker = true` is load bearing: a view defaults to running with
-- its owner's rights, which would bypass `job_views`' RLS and expose every
-- employer's traffic to every other employer. With it on, the policy applies
-- to the caller and a recruiter sees only their own team's jobs.
create or replace view public.job_view_totals
with (security_invoker = true) as
select job_id, sum(views)::bigint as views
from public.job_views
group by job_id;
