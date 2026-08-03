-- Privacy-preserving measurement of the agent discovery surfaces. Without it
-- there is no evidence whether any autonomous agent has ever found this
-- platform, which is the first question the machine-economy thesis depends on.
--
-- Like the commercial API meter, this is a daily aggregate: it stores no IP
-- address, user agent string, token, request or response body, referrer, email,
-- or visitor identifier.
--
-- `client_class` is a coarse, closed enum derived from the request and then
-- discarded. Seven possible values aggregated per day cannot identify a
-- visitor; the point is only to distinguish a machine from a browser.

create table if not exists public.agent_discovery_usage_daily (
  usage_day date not null default current_date,
  surface text not null check (surface in ('agent_card', 'agent_offers')),
  client_class text not null check (client_class in (
    'agent_runtime', 'ai_crawler', 'search_crawler', 'http_client', 'browser', 'unspecified', 'other'
  )),
  request_count bigint not null default 0 check (request_count >= 0),
  last_observed_at timestamptz not null default now(),
  primary key (usage_day, surface, client_class)
);

create index if not exists agent_discovery_usage_daily_day_idx
  on public.agent_discovery_usage_daily (usage_day desc, surface);

alter table public.agent_discovery_usage_daily enable row level security;
revoke all on table public.agent_discovery_usage_daily from public, anon, authenticated;

create or replace function public.record_agent_discovery(
  p_surface text,
  p_client_class text,
  p_observed_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_surface not in ('agent_card', 'agent_offers')
    or p_client_class not in ('agent_runtime', 'ai_crawler', 'search_crawler', 'http_client', 'browser', 'unspecified', 'other')
    or p_observed_at is null
  then raise exception 'Invalid agent discovery measurement.' using errcode = '22023'; end if;

  insert into public.agent_discovery_usage_daily
    (usage_day, surface, client_class, request_count, last_observed_at)
  values
    ((p_observed_at at time zone 'UTC')::date, p_surface, p_client_class, 1, p_observed_at)
  on conflict (usage_day, surface, client_class) do update
    set request_count = public.agent_discovery_usage_daily.request_count + 1,
        last_observed_at = greatest(public.agent_discovery_usage_daily.last_observed_at, excluded.last_observed_at);
  return 'recorded';
end;
$$;

revoke all on function public.record_agent_discovery(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_agent_discovery(text, text, timestamptz) to service_role;

comment on table public.agent_discovery_usage_daily is
  'Daily aggregate of agent discovery surface requests. Deliberately excludes IPs, user agent strings, tokens, bodies, referrers, emails, and visitor identifiers; client_class is a seven-value enum derived per request and never stored verbatim.';
