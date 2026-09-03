-- ============================================================================
-- Perch Phase 7 — external-apply tracking + public company reviews.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. applications.via — how the seeker applied.
--    'onsite'   = full application submitted on Perch (note + optional CV)
--    'external' = clicked through to the company's own apply_url; recorded so
--                 the recruiter can still see who's interested.
-- ----------------------------------------------------------------------------
alter table public.applications
  add column if not exists via text not null default 'onsite'
    check (via in ('onsite', 'external'));

-- The insert policy already requires status='published'; external jobs are
-- published too, so nothing else changes here.

-- ----------------------------------------------------------------------------
-- 2. company_reviews — a seeker rates a company (1..5) with a short review.
--    Public read when visible; author edits their own; admin moderates.
-- ----------------------------------------------------------------------------
create table if not exists public.company_reviews (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  title       text,
  body        text,
  status      text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, reviewer_id)
);

create index if not exists company_reviews_company_idx
  on public.company_reviews (company_id, status);

alter table public.company_reviews enable row level security;

-- Public read of visible reviews (anon + authenticated); author + admin see all.
drop policy if exists "company_reviews read visible or own" on public.company_reviews;
create policy "company_reviews read visible or own"
  on public.company_reviews for select
  using (
    status = 'visible'
    or reviewer_id = auth.uid()
    or public.is_admin()
  );

-- A seeker may review any company except their own; one review per company.
drop policy if exists "company_reviews insert by seeker" on public.company_reviews;
create policy "company_reviews insert by seeker"
  on public.company_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and public.current_user_role() = 'seeker'
    and not exists (
      select 1 from public.companies c
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "company_reviews update own" on public.company_reviews;
create policy "company_reviews update own"
  on public.company_reviews for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

drop policy if exists "company_reviews update by admin" on public.company_reviews;
create policy "company_reviews update by admin"
  on public.company_reviews for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "company_reviews delete own or admin" on public.company_reviews;
create policy "company_reviews delete own or admin"
  on public.company_reviews for delete to authenticated
  using (reviewer_id = auth.uid() or public.is_admin());

-- Only an admin (or service role) may change a review's moderation status; the
-- author's own UPDATE keeps whatever status the row already had.
create or replace function public.enforce_review_status_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if jwt_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin() then
    return new;
  end if;
  new.status := old.status;
  return new;
end;
$$;

drop trigger if exists enforce_review_status_rules on public.company_reviews;
create trigger enforce_review_status_rules
  before update on public.company_reviews
  for each row execute function public.enforce_review_status_rules();
