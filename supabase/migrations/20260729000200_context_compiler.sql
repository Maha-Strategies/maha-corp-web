alter table public.agent_client_credentials
  drop constraint if exists agent_client_credentials_allowed_capabilities_check;

alter table public.agent_client_credentials
  add constraint agent_client_credentials_allowed_capabilities_check check (
    allowed_capabilities <@ array['mps_audit', 'mcp_gateway', 'context_compile']::text[]
  );

-- Content itself is intentionally not persisted. The ledger is enough to
-- measure adoption and efficiency without retaining a customer's documents or
-- compiled context.
create table if not exists public.agent_context_packs (
  public_id text primary key check (public_id ~ '^ctxpack_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  client_request_id text not null check (char_length(client_request_id) between 8 and 120),
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  output_hash text not null check (output_hash ~ '^sha256:[a-f0-9]{64}$'),
  source_count smallint not null check (source_count between 1 and 8),
  token_budget integer not null check (token_budget between 64 and 16000),
  original_bytes integer not null check (original_bytes >= 0),
  compiled_bytes integer not null check (compiled_bytes >= 0),
  original_estimated_tokens integer not null check (original_estimated_tokens >= 0),
  compiled_estimated_tokens integer not null check (compiled_estimated_tokens >= 0),
  estimated_reduction_percent numeric(5,1) not null check (estimated_reduction_percent between 0 and 100),
  source_coverage_percent numeric(5,1) not null check (source_coverage_percent between 0 and 100),
  duplicate_passages_removed integer not null check (duplicate_passages_removed >= 0),
  created_at timestamptz not null default now(),
  unique (credential_id, client_request_id)
);

create index if not exists agent_context_packs_client_created_idx on public.agent_context_packs (client_id, created_at desc);
create index if not exists agent_context_packs_credential_created_idx on public.agent_context_packs (credential_id, created_at desc);

alter table public.agent_context_packs enable row level security;
grant select, insert on table public.agent_context_packs to service_role;
