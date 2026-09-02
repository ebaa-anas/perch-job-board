-- ============================================================================
-- Perch schema — full model (phases 1..5); phase 1 wires public-read RLS only.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text check (role in ('seeker', 'recruiter', 'admin')),
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.admin_emails (
  email text primary key
);

-- ----------------------------------------------------------------------------
-- seeker_profiles
-- ----------------------------------------------------------------------------
create table public.seeker_profiles (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  headline      text,
  location      text,
  bio           text,
  skills        text[] not null default '{}',
  portfolio_url text,
  linkedin_url  text,
  github_url    text,
  cv_path       text,
  cv_filename   text,
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid unique references public.profiles (id) on delete cascade,
  name        text not null,
  slug        text unique not null,
  tagline     text,
  description text,
  website     text,
  logo_path   text,
  logo_color  text not null default '#1e5f45',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- jobs
-- ----------------------------------------------------------------------------
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  company_id       uuid not null references public.companies (id) on delete cascade,
  title            text not null,
  location         text not null,
  type             text not null check (type in ('full-time','part-time','contract','internship')),
  work_mode        text not null check (work_mode in ('remote','hybrid','on-site')),
  experience       text not null check (experience in ('junior','mid','senior','lead')),
  salary_min       integer not null check (salary_min >= 0),
  salary_max       integer not null check (salary_max >= salary_min),
  currency         text not null default 'USD',
  description      text not null,
  responsibilities text[] not null default '{}',
  requirements     text[] not null default '{}',
  perks            text[] not null default '{}',
  tags             text[] not null default '{}',
  apply_url        text,
  status           text not null default 'published' check (status in ('published','draft','closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index jobs_status_created_idx on public.jobs (status, created_at desc);
create index jobs_company_idx on public.jobs (company_id);
create index jobs_tags_idx on public.jobs using gin (tags);

-- ----------------------------------------------------------------------------
-- applications
-- ----------------------------------------------------------------------------
create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  seeker_id   uuid not null references public.profiles (id) on delete cascade,
  note        text,
  cv_path     text,
  cv_filename text,
  created_at  timestamptz not null default now(),
  unique (job_id, seeker_id)
);

create index applications_job_idx on public.applications (job_id);
create index applications_seeker_idx on public.applications (seeker_id);

-- ----------------------------------------------------------------------------
-- saved_jobs
-- ----------------------------------------------------------------------------
create table public.saved_jobs (
  seeker_id  uuid not null references public.profiles (id) on delete cascade,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seeker_id, job_id)
);

-- ----------------------------------------------------------------------------
-- helper functions
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
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
    join public.companies c on c.id = j.company_id
    where j.id = target_job and c.owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- new-user trigger
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'role'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- storage buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false), ('logos', 'logos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- RLS — enable everywhere; PHASE 1 wires public-read only.
-- ----------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.admin_emails     enable row level security;
alter table public.seeker_profiles  enable row level security;
alter table public.companies        enable row level security;
alter table public.jobs             enable row level security;
alter table public.applications     enable row level security;
alter table public.saved_jobs       enable row level security;

create policy "jobs are publicly readable when published"
  on public.jobs for select
  using (status = 'published' or public.owns_job(id) or public.is_admin());

create policy "companies are publicly readable"
  on public.companies for select using (true);

create policy "seeker profiles are publicly readable"
  on public.seeker_profiles for select using (true);

-- profiles: any signed-in user may read (display names on applications later)
create policy "profiles readable by authenticated users"
  on public.profiles for select
  to authenticated using (true);

-- admin_emails: readable only by service role (no policy => anon/auth denied)
