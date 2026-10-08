-- ============================================================================
-- Perch Phase 13 — the supply-side revenue levers, and the trust signals they
-- depend on.
--
-- Three things, in one migration because they are one product decision:
-- charging employers only works if the things being bought are visible and
-- the marketplace is credible enough to be worth paying for.
--
--   1. jobs.featured_until  — boosted listings (the first paid product).
--   2. companies.verified_at — a domain-verified employer badge.
--   3. seeker_profiles.open_to_work — opt-in visibility for recruiter
--      sourcing, which is the second paid product and the one with the
--      sharpest privacy consequences.
--
-- No new tables: all three are columns on rows that already exist, which
-- keeps every policy already written over those tables in force.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Featured listings.
--
--    An expiry timestamp rather than a boolean, so a boost lapses on its own
--    and nothing has to remember to switch it off. `featured_until` in the
--    past is simply not featured, which makes the read a comparison rather
--    than a scheduled job.
--
--    Deliberately NOT writable by a recruiter: it is granted by the platform
--    on payment. The `jobs` UPDATE policy lets the owning team change their
--    own row, so the column is protected by a trigger instead — RLS cannot
--    restrict an UPDATE to a subset of columns.
-- ----------------------------------------------------------------------------
alter table public.jobs
  add column if not exists featured_until timestamptz;

create index if not exists jobs_featured_idx
  on public.jobs (featured_until desc nulls last)
  where status = 'published';

create or replace function public.protect_job_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (payments, admin console) bypasses triggers set up this
  -- way only if we let it; check the caller explicitly instead.
  if new.featured_until is distinct from old.featured_until
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'featured_until is set by the platform, not by the job owner';
  end if;
  return new;
end;
$$;

drop trigger if exists on_job_featured_change on public.jobs;
create trigger on_job_featured_change
  before update on public.jobs
  for each row execute function public.protect_job_featured();

-- ----------------------------------------------------------------------------
-- 2. Verified employers.
--
--    Set only by an admin, after checking the company's email domain matches
--    its website. The point is fraud control: a fake employer harvesting CVs
--    is the fastest way to destroy a job board's reputation, and candidates
--    need something better than a logo to judge by.
-- ----------------------------------------------------------------------------
alter table public.companies
  add column if not exists verified_at timestamptz;
alter table public.companies
  add column if not exists verified_domain text;

create or replace function public.protect_company_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.verified_at is distinct from old.verified_at
      or new.verified_domain is distinct from old.verified_domain)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'verification is set by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists on_company_verification_change on public.companies;
create trigger on_company_verification_change
  before update on public.companies
  for each row execute function public.protect_company_verification();

-- ----------------------------------------------------------------------------
-- 3. Opt-in talent sourcing.
--
--    `open_to_work` defaults to FALSE and must stay that way. A job seeker's
--    profile being searchable by employers is exactly the kind of thing that
--    must never be switched on for them — someone job-hunting quietly while
--    employed can be harmed by it. Default-off, seeker-controlled, revocable.
--
--    `open_to_work_at` records when it was turned on, so the sourcing view can
--    age entries out rather than surfacing a profile someone forgot about
--    three years ago.
-- ----------------------------------------------------------------------------
alter table public.seeker_profiles
  add column if not exists open_to_work boolean not null default false;
alter table public.seeker_profiles
  add column if not exists open_to_work_at timestamptz;

create index if not exists seeker_profiles_open_to_work_idx
  on public.seeker_profiles (open_to_work_at desc)
  where open_to_work;

create or replace function public.stamp_open_to_work()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.open_to_work and not coalesce(old.open_to_work, false) then
    new.open_to_work_at := now();
  elsif not new.open_to_work then
    new.open_to_work_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_open_to_work_change on public.seeker_profiles;
create trigger on_open_to_work_change
  before update on public.seeker_profiles
  for each row execute function public.stamp_open_to_work();

-- ----------------------------------------------------------------------------
-- 4. Close the world-readable seeker profile, then open a narrow slice of it.
--
--    0001 shipped `seeker profiles are publicly readable ... using (true)`,
--    intended as "shown on applications". The effect is wider than the intent:
--    every seeker's headline, location, bio, skills and cv_path are readable
--    by anyone with the anon key, signed in or not. The private `cvs` bucket
--    means a path is not a document, but it is still a per-person identifier
--    and the rest is plain personal data.
--
--    Adding an `open_to_work` policy on top of that would have changed
--    nothing — policies are OR'd, so a narrower one cannot take access away.
--    Opt-in sourcing is only meaningful once the base grant is removed, so
--    both happen here, together.
--
--    The replacement admits exactly the four readers the product needs:
--    the seeker, a hiring team the seeker has applied to, an admin, and —
--    new — a seated recruiter when the seeker has opted in to being found.
-- ----------------------------------------------------------------------------

/**
 * Has this seeker applied to a job belonging to the caller's company?
 *
 * This is what "shown on applications" actually meant. Security definer, so
 * the joins do not re-enter RLS on `applications`.
 */
create or replace function public.seeker_applied_to_my_company(target_seeker uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j            on j.id = a.job_id
    join public.company_members m on m.company_id = j.company_id
    where a.seeker_id = target_seeker and m.profile_id = auth.uid()
  );
$$;

drop policy if exists "seeker profiles are publicly readable" on public.seeker_profiles;
drop policy if exists "seeker_profiles readable by self, team, sourcing or admin" on public.seeker_profiles;
create policy "seeker_profiles readable by self, team, sourcing or admin"
  on public.seeker_profiles for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or public.seeker_applied_to_my_company(profile_id)
    or (
      -- Opt-in sourcing. Meaningful only because the blanket grant above is
      -- gone; `open_to_work` defaults to false and only the seeker sets it.
      open_to_work
      and public.current_user_role() = 'recruiter'
      and public.has_company_seat()
    )
  );

-- ----------------------------------------------------------------------------
-- 5. open_candidates — what a sourcing recruiter may see.
--
--    A view, because the set of columns matters as much as the set of rows: a
--    recruiter browsing talent gets the professional summary and nothing
--    else. No name, no email, no cv_path, no location more precise than the
--    seeker typed. Contact happens by inviting them to apply, not by
--    harvesting an address.
--
--    `security_invoker = true` so the policy above is what admits the reader;
--    without it the view would run as owner and hand out every profile.
-- ----------------------------------------------------------------------------
create or replace view public.open_candidates
with (security_invoker = true) as
select
  sp.profile_id,
  sp.headline,
  sp.location,
  sp.skills,
  sp.bio,
  sp.open_to_work_at
from public.seeker_profiles sp
where sp.open_to_work;

comment on view public.open_candidates is
  'Opt-in candidate summaries for recruiter sourcing. Deliberately excludes '
  'name, email and cv_path: a sourcing recruiter sees the professional '
  'summary and contacts the candidate through the product, never directly.';
