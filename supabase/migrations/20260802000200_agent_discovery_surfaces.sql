-- Widens agent discovery metering to the agentic-commerce context note and the
-- MCP gateway contract. With the agent card and the commercial manifest, these
-- are what something evaluating this platform actually reads.
--
-- Two surfaces are deliberately excluded:
--
--   /api/docs/openapi — release health requests it four times an hour and the
--   capacity harness requests it on every run, so its counts would measure our
--   own monitoring rather than agent interest. Metering it needs a way to
--   exclude internal callers first.
--
--   /llms.txt — served by a generated route that a stale public/llms.txt
--   shadows. The two conflict, and making the route dynamic to meter it turns
--   that latent conflict into a hard 500. The dead file has to go first.
--
-- Constraint replacement only; no data is read, moved, or discarded.

alter table public.agent_discovery_usage_daily
  drop constraint if exists agent_discovery_usage_daily_surface_check;

alter table public.agent_discovery_usage_daily
  add constraint agent_discovery_usage_daily_surface_check
  check (surface in ('agent_card', 'agent_offers', 'agent_context', 'mcp_contract'));

create or replace function public.record_agent_discovery(
  p_surface text,
  p_client_class text,
  p_observed_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_surface not in ('agent_card', 'agent_offers', 'agent_context', 'mcp_contract')
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
