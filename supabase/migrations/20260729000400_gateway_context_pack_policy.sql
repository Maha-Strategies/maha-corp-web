alter table public.mcp_gateway_servers
  add column if not exists context_pack_required_tools text[] not null default '{}'::text[],
  add column if not exists context_pack_id_argument text not null default 'contextPackId',
  add column if not exists context_pack_hash_argument text not null default 'contextPackHash',
  add column if not exists context_pack_content_argument text not null default 'context';

alter table public.mcp_gateway_servers
  drop constraint if exists mcp_gateway_servers_context_pack_required_tools_check;
alter table public.mcp_gateway_servers
  add constraint mcp_gateway_servers_context_pack_required_tools_check check (
    cardinality(context_pack_required_tools) <= 100
    and context_pack_required_tools <@ allowed_tool_names
  );
alter table public.mcp_gateway_servers
  drop constraint if exists mcp_gateway_servers_context_pack_argument_names_check;
alter table public.mcp_gateway_servers
  add constraint mcp_gateway_servers_context_pack_argument_names_check check (
    context_pack_id_argument ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
    and context_pack_hash_argument ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
    and context_pack_content_argument ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
    and context_pack_id_argument <> context_pack_hash_argument
    and context_pack_id_argument <> context_pack_content_argument
    and context_pack_hash_argument <> context_pack_content_argument
  );

alter table public.mcp_gateway_events
  add column if not exists context_pack_id text;
alter table public.mcp_gateway_events
  drop constraint if exists mcp_gateway_events_outcome_check;
alter table public.mcp_gateway_events
  add constraint mcp_gateway_events_outcome_check check (outcome in (
    'forwarded', 'upstream_error', 'upstream_unavailable', 'upstream_response_too_large',
    'method_not_allowed', 'tool_not_allowed', 'context_pack_required', 'context_pack_invalid'
  ));

alter table public.agent_context_pack_evaluations
  add column if not exists context_pack_id text,
  add column if not exists context_pack_output_hash text;
alter table public.agent_context_pack_evaluations
  drop constraint if exists agent_context_pack_evaluations_context_pack_id_check;
alter table public.agent_context_pack_evaluations
  add constraint agent_context_pack_evaluations_context_pack_id_check check (
    context_pack_id is null or context_pack_id ~ '^ctxpack_[a-f0-9]{32}$'
  );
alter table public.agent_context_pack_evaluations
  drop constraint if exists agent_context_pack_evaluations_context_pack_output_hash_check;
alter table public.agent_context_pack_evaluations
  add constraint agent_context_pack_evaluations_context_pack_output_hash_check check (
    context_pack_output_hash is null or context_pack_output_hash ~ '^sha256:[a-f0-9]{64}$'
  );

create index if not exists agent_context_pack_evaluations_pack_client_idx
  on public.agent_context_pack_evaluations (context_pack_id, client_id);
