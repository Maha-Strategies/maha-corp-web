-- Internal usage meter for authenticated MPS Audit Bridge tool invocations.
-- This records units only. It creates no customer balance, price, charge, or
-- payment obligation.
create table if not exists public.mps_usage_events (
  public_id text primary key check (public_id ~ '^usage_[a-f0-9]{32}$'),
  client_id text not null references public.mcp_oauth_clients(public_id) on delete restrict,
  operation text not null check (operation ~ '^[a-z][a-z0-9_]{2,79}$'),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  quantity numeric(18, 6) not null check (quantity > 0 and quantity <= 1000000),
  outcome text not null check (outcome in ('succeeded', 'failed')),
  upstream_status integer check (upstream_status between 100 and 599),
  event_hash text not null check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (client_id, operation, request_hash)
);

create index if not exists mps_usage_events_client_created_at_idx
  on public.mps_usage_events (client_id, created_at desc);

create index if not exists mps_usage_events_operation_created_at_idx
  on public.mps_usage_events (operation, created_at desc);

alter table public.mps_usage_events enable row level security;

-- No public policies: usage is internal and is written only by the Registry's
-- Supabase service role. This migration deliberately has no credit or payment table.
revoke all on table public.mps_usage_events from anon, authenticated;
