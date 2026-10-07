-- ============================================================================
-- Perch Phase 11 — saved searches, job alerts, and an in-app notification
-- centre.
--
-- Until now the product had no reason for anyone to come back: a seeker who
-- found nothing on their first visit had no way to be told when that changed,
-- and the only email the system ever sent went to recruiters. These two tables
-- are the whole re-engagement loop.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. saved_searches — a named `/jobs` query the seeker wants to be told about.
--
--    `query` stores the search-params string ("q=rust&mode=remote"), not
--    parsed columns, so a saved search and the page it was saved from can
--    never drift apart: the runner feeds this exact string back through the
--    same `parseJobFilters` the browse page uses. New filters become
--    alertable with no migration.
-- ----------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id          uuid primary key default gen_random_uuid(),
  seeker_id   uuid not null references public.profiles (id) on delete cascade,
  label       text not null,
  query       text not null default '',
  frequency   text not null default 'daily' check (frequency in ('daily', 'weekly')),
  -- Null until the first run. The runner only reports jobs posted after this.
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  -- One alert per distinct query per seeker; saving the same search twice is
  -- a mis-click, not an intent to be emailed twice.
  unique (seeker_id, query)
);

create index if not exists saved_searches_due_idx
  on public.saved_searches (frequency, last_run_at);

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches owned by seeker" on public.saved_searches;
create policy "saved_searches owned by seeker"
  on public.saved_searches for all to authenticated
  using (seeker_id = auth.uid())
  with check (seeker_id = auth.uid() and public.current_user_role() = 'seeker');

-- ----------------------------------------------------------------------------
-- 2. notifications — the in-app bell.
--
--    Insert has no policy on purpose. Every notification is system-generated
--    (an alert run, a recruiter moving someone's application) and the writer
--    is therefore never the owner of the row; they are all written over the
--    service-role client. Leaving INSERT closed means an authenticated user
--    cannot forge a notification into anyone's feed, including their own.
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('job_alert', 'application_status', 'system')),
  title      text not null,
  body       text,
  url        text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on public.notifications (profile_id, created_at desc);

-- Partial index: the unread badge is the only hot query, and it is a count.
create index if not exists notifications_unread_idx
  on public.notifications (profile_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications readable by owner" on public.notifications;
create policy "notifications readable by owner"
  on public.notifications for select to authenticated
  using (profile_id = auth.uid());

-- Marking as read is the only field a recipient may change; the columns that
-- carry the content are not writable by anyone through RLS at all.
drop policy if exists "notifications marked read by owner" on public.notifications;
create policy "notifications marked read by owner"
  on public.notifications for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "notifications deleted by owner" on public.notifications;
create policy "notifications deleted by owner"
  on public.notifications for delete to authenticated
  using (profile_id = auth.uid());
