create table if not exists public.mps_credit_checkouts (
  public_id text primary key check (public_id ~ '^credit_checkout_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_payment_amount integer check (stripe_payment_amount is null or stripe_payment_amount > 0),
  stripe_payment_currency text check (stripe_payment_currency is null or stripe_payment_currency ~ '^[a-z]{3}$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  credit_quantity integer not null check (credit_quantity between 1 and 1000000),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'failed')),
  failure_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (client_id, request_hash),
  check (
    (status = 'awaiting_payment' and paid_at is null)
    or (status = 'paid' and paid_at is not null)
    or (status = 'failed' and paid_at is null and failure_code is not null)
  )
);

create table if not exists public.mps_credit_ledger_entries (
  public_id text primary key check (public_id ~ '^credit_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  checkout_id text references public.mps_credit_checkouts(public_id) on delete restrict,
  entry_type text not null check (entry_type in ('purchase_grant', 'manual_adjustment', 'consumption', 'reversal')),
  unit text not null check (unit = 'mps_audit_invocation'),
  quantity numeric(18, 6) not null check (quantity <> 0 and quantity >= -1000000 and quantity <= 1000000),
  source_type text not null check (source_type in ('stripe_checkout_session', 'stripe_refund', 'manual', 'audit_execution', 'refund')),
  source_id text not null,
  event_hash text not null check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists mps_credit_checkouts_client_created_at_idx
  on public.mps_credit_checkouts (client_id, created_at desc);

create index if not exists mps_credit_ledger_entries_client_created_at_idx
  on public.mps_credit_ledger_entries (client_id, created_at desc);

alter table public.mps_credit_checkouts enable row level security;
alter table public.mps_credit_ledger_entries enable row level security;

-- No public policies: server-side routes using the Supabase service role are
-- the only ledger writers. The credit unit is not USD and this migration does
-- not enable deduction or payment enforcement. Stripe refund events create
-- compensating reversal entries; purchase grants are not edited in place.
revoke all on table public.mps_credit_checkouts from anon, authenticated;
revoke all on table public.mps_credit_ledger_entries from anon, authenticated;
