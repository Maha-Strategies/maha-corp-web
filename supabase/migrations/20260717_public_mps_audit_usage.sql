create extension if not exists pgcrypto;

create table if not exists public.mps_public_audit_usage (
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  usage_day date not null default current_date,
  audit_count smallint not null default 1 check (audit_count between 1 and 3),
  last_used_at timestamptz not null default now(),
  primary key (visitor_hash, usage_day)
);

create table if not exists public.mps_public_audit_events (
  id uuid primary key default gen_random_uuid(),
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('submitted', 'completed', 'failed', 'record_downloaded')),
  input_char_count integer check (input_char_count is null or input_char_count between 1 and 6000),
  claim_count smallint check (claim_count is null or claim_count between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists mps_public_audit_events_created_at_idx
  on public.mps_public_audit_events (created_at desc);

create or replace function public.consume_public_mps_audit_quota(
  p_visitor_hash text,
  p_daily_limit smallint default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count smallint;
begin
  if p_visitor_hash !~ '^sha256:[a-f0-9]{64}$' or p_daily_limit < 1 or p_daily_limit > 3 then
    raise exception 'Invalid public audit quota request.' using errcode = '22023';
  end if;

  insert into public.mps_public_audit_usage (visitor_hash, usage_day, audit_count, last_used_at)
  values (p_visitor_hash, current_date, 1, now())
  on conflict (visitor_hash, usage_day) do update
    set audit_count = public.mps_public_audit_usage.audit_count + 1,
        last_used_at = now()
    where public.mps_public_audit_usage.audit_count < p_daily_limit
  returning audit_count into accepted_count;

  return found;
end;
$$;

alter table public.mps_public_audit_usage enable row level security;
alter table public.mps_public_audit_events enable row level security;

revoke all on table public.mps_public_audit_usage from anon, authenticated;
revoke all on table public.mps_public_audit_events from anon, authenticated;
revoke all on function public.consume_public_mps_audit_quota(text, smallint) from public, anon, authenticated;
grant execute on function public.consume_public_mps_audit_quota(text, smallint) to service_role;

comment on table public.mps_public_audit_events is
  'Privacy-preserving public MPS audit funnel events. Source text and source-text hashes are never stored here.';
