-- ============================================================================
-- Perch Phase 2 — close two write-side holes found in the 0002 review.
--
--  1. profiles.role escalation: "profiles update own" (0002) lets an
--     authenticated user run `update profiles set role='admin' where
--     id=auth.uid()` straight from the browser. A BEFORE UPDATE trigger now
--     pins `role`: NULL -> ('seeker'|'recruiter') once at onboarding, immutable
--     afterwards. The service-role key (used by maybeUpgradeAdmin) and direct
--     DB roles bypass the trigger, so admin promotion still works server-side.
--
--  2. owner repoint: the 0002 UPDATE policies on seeker_profiles / companies
--     have USING but no WITH CHECK, so a row's owner column could be rewritten
--     to another user's id (or NULL). Recreated here with a matching WITH CHECK.
--
-- Re-runnable: every object uses `create or replace` / `drop ... if exists`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.role is not user-writable
-- ----------------------------------------------------------------------------
-- NOTE: SECURITY INVOKER (the default) is deliberate. A SECURITY DEFINER trigger
-- would see current_user = the function owner (postgres) for *every* caller, so
-- the trusted-caller bypass below would always fire and the guard would be inert.
-- As INVOKER, current_user is the real PostgREST role: 'authenticated' for a
-- normal user (guard enforced), 'service_role' for the service key, 'postgres'
-- for direct/migration connections (guard bypassed — that is how
-- maybeUpgradeAdmin() promotes an admin_emails address).
create or replace function public.enforce_profile_role_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if jwt_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if old.role is null then
    -- Onboarding: the only self-service transition. Any value other than the
    -- two signup roles (i.e. an attempted self-promotion to 'admin') is
    -- silently reverted, so completeOnboarding cannot be abused via a crafted
    -- request even if the action-layer guard were bypassed.
    if new.role is not null and new.role not in ('seeker', 'recruiter') then
      new.role := old.role;
    end if;
  elsif new.role is distinct from old.role then
    -- Role is immutable once chosen (for non-trusted callers).
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_role_rules on public.profiles;
create trigger enforce_profile_role_rules
  before update on public.profiles
  for each row execute function public.enforce_profile_role_rules();

-- ----------------------------------------------------------------------------
-- 2. seeker_profiles / companies — UPDATE cannot repoint the owner column
-- ----------------------------------------------------------------------------
drop policy if exists "seeker_profiles update own" on public.seeker_profiles;
create policy "seeker_profiles update own"
  on public.seeker_profiles for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "companies update own" on public.companies;
create policy "companies update own"
  on public.companies for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
