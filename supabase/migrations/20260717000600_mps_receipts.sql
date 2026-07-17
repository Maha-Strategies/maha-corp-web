-- Public MPS Registry receipt ledger. Rows are written only by the Registry's
-- Supabase service role; the HTTP API is the public verification surface.
create table if not exists public.mps_receipts (
  public_id text primary key check (public_id ~ '^receipt_[a-f0-9]{32}$'),
  record_id text not null check (record_id ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  record_hash text not null unique check (record_hash ~ '^sha256:[a-f0-9]{64}$'),
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  record jsonb not null,
  receipt jsonb not null,
  issued_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mps_receipts_issued_at_idx on public.mps_receipts (issued_at desc);
create index if not exists mps_receipts_record_id_idx on public.mps_receipts (record_id);

alter table public.mps_receipts enable row level security;

-- No public policies: application access uses the Supabase service role and
-- public verification remains controlled by mps.mahastrategies.com.
revoke all on table public.mps_receipts from anon, authenticated;
