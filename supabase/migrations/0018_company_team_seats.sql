-- ============================================================================
-- Perch Phase 12 — company team seats.
--
-- Until now `companies.owner_id` was UNIQUE and every authorisation check
-- resolved to "are you that one person". No company with more than one
-- recruiter could use the product at all.
--
-- The fix is deliberately narrow. Almost every policy in migrations 0001–0015
-- funnels through three security-definer helpers — `owns_company()`,
-- `owns_job()` and `owns_application()`. Redefining those three to consult a
-- membership table makes jobs, applications, application questions, the
-- pipeline and the event log team-aware *without editing a single policy*.
-- Only the handful of policies that compare `owner_id` directly are rewritten
-- below, and they are the ones that genuinely belong to the owner alone.
--
-- Scope choice: membership stays single-valued (`unique (profile_id)`). The
-- blocker was many recruiters per company, not one recruiter across many
-- companies, so every existing "my company" read stays single-valued too.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_members
-- ----------------------------------------------------------------------------
create table if not exists public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'recruiter'
    check (role in ('owner', 'admin', 'recruiter')),
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id),
  -- One seat per person: keeps `getOwnCompany()` and friends single-valued.
  unique (profile_id)
);

create index if not exists company_members_company_idx
  on public.company_members (company_id, role);

-- Exactly one owner per company, enforced rather than assumed.
create unique index if not exists company_members_single_owner_idx
  on public.company_members (company_id)
  where role = 'owner';

-- ----------------------------------------------------------------------------
-- 2. Backfill: every existing company's owner becomes its owner-member.
--    Runs before the helpers are redefined so no recruiter loses access
--    mid-migration.
-- ----------------------------------------------------------------------------
insert into public.company_members (company_id, profile_id, role)
select c.id, c.owner_id, 'owner'
from public.companies c
where c.owner_id is not null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3. Membership helpers.
-- ----------------------------------------------------------------------------
create or replace function public.is_company_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target and m.profile_id = auth.uid()
  );
$$;

/** Owner or admin: authority over the company itself, not just its hiring. */
create or replace function public.can_manage_company(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target
      and m.profile_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. Redefine the three ownership helpers in terms of membership.
--    Same names, same signatures, same semantics ("may this caller act for
--    the company behind this row") — so every policy that calls them picks
--    the new behaviour up with no change.
-- ----------------------------------------------------------------------------
create or replace function public.owns_company(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target and m.profile_id = auth.uid()
  );
$$;

create or replace function public.owns_job(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    join public.company_members m on m.company_id = j.company_id
    where j.id = target_job and m.profile_id = auth.uid()
  );
$$;

create or replace function public.owns_application(target_application uuid)
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
    where a.id = target_application and m.profile_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. The policies that compared owner_id directly.
-- ----------------------------------------------------------------------------

/**
 * Does the caller already hold a seat anywhere?
 *
 * Needed by the `companies` INSERT policy, which cannot use
 * `is_company_member()` because the company does not exist yet. Without this
 * check a recruiter who already sits on someone else's team could create a
 * second company, and `handle_new_company()` would hit the one-seat-per-person
 * constraint and (because it is ON CONFLICT DO NOTHING) leave them owning a
 * company they are not a member of, i.e. one they cannot administer.
 */
create or replace function public.has_company_seat()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m where m.profile_id = auth.uid()
  );
$$;

-- A recruiter creates at most one company, and only if they do not already
-- hold a seat on another team.
drop policy if exists "companies insert own" on public.companies;
create policy "companies insert own"
  on public.companies for insert
  with check (
    owner_id = auth.uid()
    and public.current_user_role() = 'recruiter'
    and not public.has_company_seat()
  );

-- Editing the company profile is an admin-and-up act (0002/0003 had it as
-- owner-only, which was the same thing when there was only ever one member).
drop policy if exists "companies update own" on public.companies;
create policy "companies update own"
  on public.companies for update
  using (public.can_manage_company(id))
  with check (public.can_manage_company(id));

-- Deleting stays with the owner alone: it is irreversible and cascades to
-- every job, application and CV snapshot beneath it.
drop policy if exists "companies delete own or admin" on public.companies;
create policy "companies delete own or admin"
  on public.companies for delete
  using (owner_id = auth.uid() or public.is_admin());

-- A seeker may not review a company they work for. Previously this only
-- excluded the owner; with seats it must exclude the whole team.
drop policy if exists "company_reviews insert by seeker" on public.company_reviews;
create policy "company_reviews insert by seeker"
  on public.company_reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and public.current_user_role() = 'seeker'
    and not public.is_company_member(company_id)
  );

-- ----------------------------------------------------------------------------
-- 6. company_members RLS.
-- ----------------------------------------------------------------------------
alter table public.company_members enable row level security;

drop policy if exists "company_members readable by teammates" on public.company_members;
create policy "company_members readable by teammates"
  on public.company_members for select to authenticated
  using (public.is_company_member(company_id) or public.is_admin());

-- Joining happens through `accept_company_invite()`, never a direct insert:
-- an invitee is by definition not yet a member, so no policy could authorise
-- them without also authorising self-insertion into any company.
drop policy if exists "company_members inserted by manager" on public.company_members;
create policy "company_members inserted by manager"
  on public.company_members for insert to authenticated
  with check (public.can_manage_company(company_id) and role <> 'owner');

-- The owner row is immutable here; ownership moves via transfer_company_ownership().
drop policy if exists "company_members role changed by manager" on public.company_members;
create policy "company_members role changed by manager"
  on public.company_members for update to authenticated
  using (role <> 'owner' and public.can_manage_company(company_id))
  with check (role <> 'owner' and public.can_manage_company(company_id));

-- A manager removes a teammate; anyone may remove themselves (leave). The
-- owner cannot be removed at all — deleting the company is the way out.
drop policy if exists "company_members removed by manager or self" on public.company_members;
create policy "company_members removed by manager or self"
  on public.company_members for delete to authenticated
  using (
    role <> 'owner'
    and (public.can_manage_company(company_id) or profile_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 7. New companies seed their own owner-member.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.company_members (company_id, profile_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_company_created on public.companies;
create trigger on_company_created
  after insert on public.companies
  for each row execute function public.handle_new_company();

-- ----------------------------------------------------------------------------
-- 8. company_invites — pending seats, addressed by email.
-- ----------------------------------------------------------------------------
create table if not exists public.company_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  email       text not null,
  role        text not null default 'recruiter' check (role in ('admin', 'recruiter')),
  token       text not null unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now()
);

create index if not exists company_invites_company_idx
  on public.company_invites (company_id, created_at desc);

create index if not exists company_invites_email_idx
  on public.company_invites (lower(email));

-- One live invite per address per company; re-inviting replaces, not stacks.
create unique index if not exists company_invites_pending_idx
  on public.company_invites (company_id, lower(email))
  where accepted_at is null;

alter table public.company_invites enable row level security;

-- Managers see their company's invites; an invitee sees the ones addressed to
-- them, so the accept screen can name the company before they commit.
drop policy if exists "company_invites readable by manager or invitee" on public.company_invites;
create policy "company_invites readable by manager or invitee"
  on public.company_invites for select to authenticated
  using (
    public.can_manage_company(company_id)
    or public.is_admin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "company_invites written by manager" on public.company_invites;
create policy "company_invites written by manager"
  on public.company_invites for insert to authenticated
  with check (public.can_manage_company(company_id) and invited_by = auth.uid());

drop policy if exists "company_invites revoked by manager" on public.company_invites;
create policy "company_invites revoked by manager"
  on public.company_invites for delete to authenticated
  using (public.can_manage_company(company_id));

-- No UPDATE policy: `accepted_at` is stamped by accept_company_invite() alone.

-- ----------------------------------------------------------------------------
-- 9. accept_company_invite(token) — the one path into a team.
--
--    Security definer because the caller is not yet a member and so cannot
--    satisfy any insert policy on `company_members`. Every precondition is
--    re-checked here rather than trusted from the app, and the result is a
--    status string so the UI can explain the refusal instead of failing
--    opaquely.
-- ----------------------------------------------------------------------------
create or replace function public.accept_company_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite      public.company_invites;
  caller      uuid := auth.uid();
  caller_mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if caller is null then
    return 'not_signed_in';
  end if;

  select * into invite
  from public.company_invites
  where token = p_token
  limit 1;

  if invite.id is null then
    return 'not_found';
  end if;
  if invite.accepted_at is not null then
    return 'already_accepted';
  end if;
  if invite.expires_at < now() then
    return 'expired';
  end if;
  -- The invite is addressed to a person, not to whoever holds the link.
  if lower(invite.email) <> caller_mail then
    return 'wrong_email';
  end if;
  -- Role is immutable (0003), so a seeker account cannot take a recruiter seat.
  if public.current_user_role() <> 'recruiter' then
    return 'not_recruiter';
  end if;
  if exists (select 1 from public.company_members m where m.profile_id = caller) then
    return 'already_member';
  end if;

  insert into public.company_members (company_id, profile_id, role)
  values (invite.company_id, caller, invite.role);

  update public.company_invites
  set accepted_at = now()
  where id = invite.id;

  return 'ok';
end;
$$;

revoke all on function public.accept_company_invite(text) from public, anon;
grant execute on function public.accept_company_invite(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. transfer_company_ownership(company, to_profile)
--
--     Both role rows move in one statement so the single-owner index is never
--     transiently violated, and only the sitting owner may call it.
-- ----------------------------------------------------------------------------
create or replace function public.transfer_company_ownership(
  p_company uuid,
  p_to      uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return 'not_signed_in';
  end if;
  if not exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.profile_id = caller and m.role = 'owner'
  ) then
    return 'not_owner';
  end if;
  if p_to = caller then
    return 'already_owner';
  end if;
  if not exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.profile_id = p_to
  ) then
    return 'not_a_member';
  end if;

  update public.company_members
  set role = case
    when profile_id = p_to   then 'owner'
    when profile_id = caller then 'admin'
    else role
  end
  where company_id = p_company and profile_id in (p_to, caller);

  -- Keep the denormalised anchor on `companies` in step; the delete policy
  -- and billing both still read it.
  update public.companies set owner_id = p_to where id = p_company;

  return 'ok';
end;
$$;

revoke all on function public.transfer_company_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_company_ownership(uuid, uuid) to authenticated;
