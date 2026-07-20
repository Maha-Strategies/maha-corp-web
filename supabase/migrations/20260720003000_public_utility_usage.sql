-- Generic per-visitor daily quota + privacy-preserving funnel events for the
-- free tier of self-serve micro-utilities (receipt→CSV, etc.). Mirrors the
-- public MPS audit quota, but keyed by (visitor_hash, utility) so one table
-- serves every current and future utility. No user input is ever stored here —
-- only a salted visitor hash, the utility name, and counts.
create extension if not exists pgcrypto;

create table if not exists public.public_utility_usage (
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  utility text not null check (utility ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  usage_day date not null default current_date,
  run_count smallint not null default 1 check (run_count between 1 and 50),
  last_used_at timestamptz not null default now(),
  primary key (visitor_hash, utility, usage_day)
);

create table if not exists public.public_utility_events (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  utility text not null check (utility ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  event_type text not null check (event_type in ('submitted', 'completed', 'failed', 'infeasible', 'downloaded', 'checkout_clicked')),
  input_char_count integer check (input_char_count is null or input_char_count between 0 and 100000),
  created_at timestamptz not null default now()
);

create index if not exists public_utility_events_created_at_idx
  on public.public_utility_events (created_at desc);

create or replace function public.consume_public_utility_quota(
  p_visitor_hash text,
  p_utility text,
  p_daily_limit smallint default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_utility !~ '^[a-z0-9][a-z0-9-]{1,63}$'
     or p_daily_limit < 1 or p_daily_limit > 50 then
    raise exception 'Invalid public utility quota request.' using errcode = '22023';
  end if;

  insert into public.public_utility_usage (visitor_hash, utility, usage_day, run_count, last_used_at)
  values (p_visitor_hash, p_utility, current_date, 1, now())
  on conflict (visitor_hash, utility, usage_day) do update
    set run_count = public.public_utility_usage.run_count + 1,
        last_used_at = now()
    where public.public_utility_usage.run_count < p_daily_limit;

  return found;
end;
$$;

alter table public.public_utility_usage enable row level security;
alter table public.public_utility_events enable row level security;

revoke all on table public.public_utility_usage from public, anon, authenticated;
revoke all on table public.public_utility_events from public, anon, authenticated;
grant select, insert, update on table public.public_utility_usage to service_role;
grant select, insert on table public.public_utility_events to service_role;

revoke all on function public.consume_public_utility_quota(text, text, smallint) from public, anon, authenticated;
grant execute on function public.consume_public_utility_quota(text, text, smallint) to service_role;

comment on table public.public_utility_events is
  'Privacy-preserving free-tier utility funnel events. Raw user input is never stored here — only a salted visitor hash, the utility name, and counts.';
