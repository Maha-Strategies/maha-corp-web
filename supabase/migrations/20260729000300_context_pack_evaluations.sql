-- Evaluation records retain only aggregate results and hashes. Required
-- evidence text, source documents, and compiled packs are never persisted.
create table if not exists public.agent_context_pack_evaluations (
  public_id text primary key check (public_id ~ '^ctxeval_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  client_request_id text not null check (char_length(client_request_id) between 8 and 120),
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  output_hash text not null check (output_hash ~ '^sha256:[a-f0-9]{64}$'),
  source_count smallint not null check (source_count between 1 and 8),
  token_budget integer not null check (token_budget between 64 and 16000),
  original_estimated_tokens integer not null check (original_estimated_tokens >= 0),
  compiled_estimated_tokens integer not null check (compiled_estimated_tokens >= 0),
  estimated_reduction_percent numeric(5,1) not null check (estimated_reduction_percent between 0 and 100),
  required_evidence_count smallint not null check (required_evidence_count between 1 and 32),
  retained_evidence_count smallint not null check (retained_evidence_count between 0 and 32 and retained_evidence_count <= required_evidence_count),
  required_evidence_retention_percent numeric(5,1) not null check (required_evidence_retention_percent between 0 and 100),
  created_at timestamptz not null default now(),
  unique (credential_id, client_request_id)
);

create index if not exists agent_context_pack_evaluations_client_created_idx on public.agent_context_pack_evaluations (client_id, created_at desc);
alter table public.agent_context_pack_evaluations enable row level security;
grant select, insert on table public.agent_context_pack_evaluations to service_role;
