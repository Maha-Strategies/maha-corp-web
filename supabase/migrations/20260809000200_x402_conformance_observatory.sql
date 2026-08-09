-- Append-only factual observations from the public x402 conformance
-- observatory. This is deliberately not a trust score or a general liveness
-- monitor. It records only protocol/discovery check states, bounded rule IDs,
-- and an optional public settlement transaction when a resource operator has
-- explicitly enabled that check.

create table if not exists public.x402_observatory_observations (
  observation_id uuid primary key,
  resource_id text not null check (resource_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(resource_id) <= 120),
  resource_url text not null check (resource_url ~ '^https://' and char_length(resource_url) <= 2048),
  observed_at timestamptz not null default now(),
  duration_ms integer not null check (duration_ms >= 0 and duration_ms <= 300000),
  challenge_reachable text not null check (challenge_reachable in ('pass', 'fail', 'unknown', 'not_applicable')),
  v2_compliant text not null check (v2_compliant in ('pass', 'fail', 'unknown', 'not_applicable')),
  schema_valid text not null check (schema_valid in ('pass', 'fail', 'unknown', 'not_applicable')),
  crawler_receives_402 text not null check (crawler_receives_402 in ('pass', 'fail', 'unknown', 'not_applicable')),
  bazaar_state text not null check (bazaar_state in ('current', 'stale', 'missing', 'unknown', 'not_declared')),
  digest_source text not null check (digest_source in ('catalog', 'reconstructed', 'none')),
  settlement_state text not null check (settlement_state in ('disabled', 'not_run', 'success', 'failed', 'indeterminate')),
  settlement_transaction text check (settlement_transaction is null or settlement_transaction ~ '^0x[0-9a-fA-F]{64}$'),
  finding_codes text[] not null default '{}' check (cardinality(finding_codes) <= 40),
  created_at timestamptz not null default now()
);

create index if not exists x402_observatory_resource_observed_idx
  on public.x402_observatory_observations (resource_id, observed_at desc);

alter table public.x402_observatory_observations enable row level security;
revoke all on table public.x402_observatory_observations from public, anon, authenticated;
grant select, insert on table public.x402_observatory_observations to service_role;
revoke update, delete, truncate on table public.x402_observatory_observations from service_role;

comment on table public.x402_observatory_observations is
  'Append-only protocol and discovery observations for explicitly allowlisted public x402 resources. No payloads, credentials, IPs, response bodies, or subjective trust scores.';
