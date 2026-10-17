-- ============================================================================
-- Perch Phase 15 — shared demo logins must stay shared.
--
-- Demo mode (NEXT_PUBLIC_DEMO_MODE) signs every visitor into one of two
-- shared accounts on @seed.perch.test. The app refuses account changes for
-- those logins (src/features/demo), but a visitor holds a genuine session and
-- can call the Supabase Auth API directly, past every Server Action. Two rules
-- therefore have to hold in the database itself:
--
--   1. A seed-domain account's email never changes. Changing it is the one
--      step that would turn a shared login into somebody's private account,
--      and carry it off the domain the nightly reset clears.
--   2. A seed-domain address is never an admin. `is_admin()` matches the JWT
--      email against `admin_emails`, so one stray row would hand the admin
--      console to anyone who clicks "Try the demo".
--
-- Both key on the reserved `.test` domain, which no real person can hold or
-- receive mail at. RLS is not touched.
--
-- Passwords are deliberately not frozen here: the seed and the demo sign-in's
-- self-repair (restoreDemoPassword) both set them through the admin API, and
-- a trigger cannot tell that apart from a visitor's own call. The sign-in
-- action restores a changed password instead.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Freeze email for seed-domain accounts; keep everyone else off the domain.
--
--    GoTrue changes an address two ways: `email` directly (admin API, or with
--    confirmations off), or `email_change` while a confirmation link is
--    outstanding. Refusing the pending address stops that flow before any
--    link could work.
--
--    Inserts (the seed) and deletes (the reset) are untouched: that is what
--    the domain is for. The trigger is limited to updates naming these two
--    columns, so sign-ins and metadata writes never reach it.
-- ----------------------------------------------------------------------------
create or replace function public.guard_demo_account_email()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_email   text := lower(coalesce(old.email, ''));
  new_email   text := lower(coalesce(new.email, ''));
  old_pending text := lower(coalesce(old.email_change, ''));
  new_pending text := lower(coalesce(new.email_change, ''));
  was_demo    boolean := old_email like '%@seed.perch.test';
begin
  -- A direct change: off the demo domain, or onto it from a real account.
  if new_email <> old_email and (was_demo or new_email like '%@seed.perch.test') then
    raise exception 'demo account email addresses cannot be changed'
      using errcode = 'P0001';
  end if;

  -- Starting a confirmation towards a new address. Clearing it is fine.
  if new_pending <> '' and new_pending <> old_pending
     and (was_demo or new_pending like '%@seed.perch.test') then
    raise exception 'demo account email addresses cannot be changed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.guard_demo_account_email() is
  'Keeps @seed.perch.test accounts (the shared demo logins) on their address, '
  'and every other account off that domain. See migration 0023.';

drop trigger if exists on_auth_user_email_guard on auth.users;
create trigger on_auth_user_email_guard
  before update of email, email_change on auth.users
  for each row execute function public.guard_demo_account_email();

-- ----------------------------------------------------------------------------
-- 2. No demo address in admin_emails, ever.
--
--    The app refuses this too (isListedAdminEmail, and the seed refuses a
--    SEED_ADMIN_EMAIL on the domain); this makes it true for a row typed into
--    the SQL editor as well.
-- ----------------------------------------------------------------------------
alter table public.admin_emails
  drop constraint if exists admin_emails_not_demo;

alter table public.admin_emails
  add constraint admin_emails_not_demo
  check (lower(email) not like '%@seed.perch.test');
