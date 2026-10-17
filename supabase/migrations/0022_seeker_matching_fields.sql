-- ============================================================================
-- Perch Phase 14 — give the candidate the same vocabulary as the job.
--
-- Every dimension a recruiter can describe a job with had no counterpart on
-- the seeker: `jobs` carries type, work_mode, experience, visa_sponsorship
-- and no_experience_required, while `seeker_profiles` carried a headline, a
-- bio and a bag of free-text skills. Skills-against-tags was the only axis on
-- which the two sides could meet, which is precisely why the match score
-- compares nothing else.
--
-- These columns close that gap. Values are drawn from the *same* CHECK lists
-- as `jobs`, so the two sides are comparable without a translation layer —
-- that is the whole point, and a separate vocabulary here would defeat it.
--
-- Every column is nullable with no default. "Not said" has to stay
-- distinguishable from "said no": a seeker who has not answered must never be
-- filtered out as though they had, and the match score must never charge them
-- for a blank.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Work authorisation.
--
--    The board's wedge is visa-sponsored and relocation hiring: `jobs` has
--    advertised `visa_sponsorship` since 0010, but a candidate could not say
--    whether they need it. So sponsorship roles and dead ends looked identical
--    to the person they matter most to.
--
--    Two separate facts, deliberately not one enum: needing sponsorship and
--    already holding the right to work are independent, and a single field
--    would force a false choice for anyone mid-application.
-- ----------------------------------------------------------------------------
alter table public.seeker_profiles
  add column if not exists needs_visa_sponsorship boolean;

alter table public.seeker_profiles
  add column if not exists work_authorization text
    check (work_authorization in ('citizen', 'permit', 'student', 'none'));

comment on column public.seeker_profiles.needs_visa_sponsorship is
  'True when the seeker requires sponsorship to take a role. Compared against '
  'jobs.visa_sponsorship. NULL means not answered, which is never treated as '
  'either answer.';

-- ----------------------------------------------------------------------------
-- 2. Experience.
--
--    Same four values as `jobs.experience`, so the two are directly
--    comparable. `no_professional_experience` is the counterpart to
--    `jobs.no_experience_required` (0010) — without it the early-career wedge
--    could advertise entry-level roles but not find the people they exist for.
-- ----------------------------------------------------------------------------
alter table public.seeker_profiles
  add column if not exists experience text
    check (experience in ('junior', 'mid', 'senior', 'lead'));

alter table public.seeker_profiles
  add column if not exists no_professional_experience boolean;

-- ----------------------------------------------------------------------------
-- 3. Preferences.
--
--    Arrays rather than single values: people will take a full-time role or
--    an internship, remote or hybrid. Empty array means "no preference", which
--    matches everything — the same semantics the job filters already use.
--
--    Contents are validated in the app (`seekerProfileSchema`) rather than by
--    a CHECK constraint, because Postgres cannot constrain array elements
--    without a trigger, and the Zod enums are built from the same
--    JOB_TYPES / WORK_MODES constants the job form uses.
-- ----------------------------------------------------------------------------
alter table public.seeker_profiles
  add column if not exists desired_types text[] not null default '{}';

alter table public.seeker_profiles
  add column if not exists desired_work_modes text[] not null default '{}';

alter table public.seeker_profiles
  add column if not exists desired_locations text[] not null default '{}';

-- Sourcing and alerting both narrow by experience first.
create index if not exists seeker_profiles_experience_idx
  on public.seeker_profiles (experience)
  where experience is not null;

-- ----------------------------------------------------------------------------
-- 4. RLS is deliberately untouched.
--
--    0021 replaced the original blanket `using (true)` with four readers: the
--    seeker, a hiring team they applied to, an admin, and a seated recruiter
--    when `open_to_work` is set. Columns added to an existing table inherit
--    those policies, so nothing here widens who can read a profile — and
--    these fields are more sensitive than the old ones, not less. Work
--    authorisation in particular is exactly the kind of attribute that must
--    not become browsable.
--
--    `open_candidates` (the sourcing view) is intentionally NOT extended with
--    these columns in this migration: adding them is a product decision about
--    what recruiters may filter strangers by, and it deserves its own change
--    rather than arriving as a side effect of a schema migration.
-- ----------------------------------------------------------------------------
