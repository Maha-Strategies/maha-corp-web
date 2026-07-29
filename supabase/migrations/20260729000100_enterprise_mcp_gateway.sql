-- The first Enterprise MCP Gateway release is a tenant-scoped registry,
-- allowlist policy and append-only event ledger. It deliberately stores no
-- upstream credential: private upstream authorization arrives only with a
-- separate OAuth token-exchange implementation.

alter table public.agent_client_credentials
  drop constraint if exists agent_client_credentials_allowed_capabilities_check;

alter table public.agent_client_credentials
  add constraint agent_client_credentials_allowed_capabilities_check check (
    allowed_capabilities <@ array['mps_audit', 'mcp_gateway']::text[]
  );

create table if not exists public.mcp_gateway_servers (
  public_id text primary key check (public_id ~ '^mcp_srv_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 160),
  endpoint_url text not null check (endpoint_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'disabled')),
  allowed_methods text[] not null check (
    cardinality(allowed_methods) > 0
    and allowed_methods <@ array[
      'initialize', 'notifications/initialized', 'ping', 'tools/list',
      'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call'
    ]::text[]
  ),
  allowed_tool_names text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, endpoint_url)
);

create table if not exists public.mcp_gateway_events (
  id uuid primary key default gen_random_uuid(),
  server_id text not null references public.mcp_gateway_servers(public_id) on delete restrict,
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  mcp_method text,
  tool_name text,
  outcome text not null check (outcome in (
    'forwarded', 'upstream_error', 'upstream_unavailable', 'upstream_response_too_large',
    'method_not_allowed', 'tool_not_allowed'
  )),
  upstream_status integer check (upstream_status between 100 and 599),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists mcp_gateway_servers_client_status_idx
  on public.mcp_gateway_servers (client_id, status, created_at desc);
create index if not exists mcp_gateway_events_server_created_idx
  on public.mcp_gateway_events (server_id, created_at desc);
create index if not exists mcp_gateway_events_client_created_idx
  on public.mcp_gateway_events (client_id, created_at desc);

alter table public.mcp_gateway_servers enable row level security;
alter table public.mcp_gateway_events enable row level security;

grant select, insert, update on table public.mcp_gateway_servers to service_role;
grant select, insert on table public.mcp_gateway_events to service_role;
