-- ============================================================================
-- Perch Phase 10 — abuse control for the public write paths.
--
-- The v1 spec (§13) accepted "no rate limiting / CAPTCHA" as a known risk.
-- With a public apply endpoint and public review submission that risk is now
-- the cheapest way to damage the product: CV harvesting, review brigading,
-- signup floods.
--
-- Counters live in Postgres rather than in process memory because the app runs
-- on serverless functions — each invocation gets its own heap, so an in-memory
-- counter limits nothing. One table plus one function, called only by the
-- service-role client.
-- ============================================================================

create table if not exists public.rate_limit_hits (
  id       bigserial primary key,
  bucket   text not null,
  identity text not null,
  hit_at   timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (bucket, identity, hit_at desc);

alter table public.rate_limit_hits enable row level security;
-- No policies at all: unreachable from anon/authenticated. The function below
-- is security definer, and the app only ever calls it over the service role.

/**
 * Record one attempt and report whether it is allowed.
 *
 * Returns true when the caller is under `p_max` attempts in the trailing
 * `p_window_seconds`, having recorded this one. Returns false and records
 * nothing when the caller is already at the limit, so a client hammering a
 * blocked endpoint cannot extend its own lockout.
 */
create or replace function public.consume_rate_limit(
  p_bucket         text,
  p_identity       text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  used integer;
begin
  -- Opportunistic cleanup: this identity's expired hits, not a table scan.
  delete from public.rate_limit_hits
  where bucket = p_bucket and identity = p_identity and hit_at < window_start;

  select count(*) into used
  from public.rate_limit_hits
  where bucket = p_bucket and identity = p_identity and hit_at >= window_start;

  if used >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, identity) values (p_bucket, p_identity);
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
