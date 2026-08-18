-- Minimal, first-party telemetry for the frozen x402 Trust replay. This table
-- stores no visitor identifier, IP address, user agent, referrer, report,
-- evidence body, credential, wallet address, or payment material.

create table if not exists public.x402_trust_demo_events (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null unique check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('demo_started','scenario_completed','evidence_downloaded','integration_requested')),
  scenario_id text check (scenario_id is null or scenario_id in ('proceed','review','deny')),
  recorded_at timestamptz not null default now(),
  check (
    (event_type in ('scenario_completed','evidence_downloaded') and scenario_id is not null)
    or (event_type in ('demo_started','integration_requested') and scenario_id is null)
  )
);

create index if not exists x402_trust_demo_events_type_recorded_idx
  on public.x402_trust_demo_events (event_type, recorded_at desc);

alter table public.x402_trust_demo_events enable row level security;
revoke all on table public.x402_trust_demo_events from public, anon, authenticated;
grant select, insert on table public.x402_trust_demo_events to service_role;

create or replace function public.record_x402_trust_demo_event(
  p_event_hash text,
  p_event_type text,
  p_scenario_id text,
  p_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_event_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_event_type not in ('demo_started','scenario_completed','evidence_downloaded','integration_requested')
    or (p_scenario_id is not null and p_scenario_id not in ('proceed','review','deny'))
    or (p_event_type in ('scenario_completed','evidence_downloaded') and p_scenario_id is null)
    or (p_event_type in ('demo_started','integration_requested') and p_scenario_id is not null)
    or p_at is null
  then raise exception 'Invalid x402 Trust demo event.' using errcode='22023'; end if;

  insert into public.x402_trust_demo_events (event_hash,event_type,scenario_id,recorded_at)
    values (p_event_hash,p_event_type,p_scenario_id,p_at)
    on conflict (event_hash) do nothing;
  return 'recorded';
end;
$$;

revoke all on function public.record_x402_trust_demo_event(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_x402_trust_demo_event(text,text,text,timestamptz) to service_role;
