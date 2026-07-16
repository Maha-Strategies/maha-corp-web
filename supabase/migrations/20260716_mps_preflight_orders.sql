create table if not exists public.mps_preflight_orders (
  public_id text primary key check (public_id ~ '^preflight_[a-f0-9]{32}$'),
  access_hash text not null check (access_hash ~ '^sha256:[a-f0-9]{64}$'),
  customer_email text not null,
  document_label text,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'processing', 'completed', 'failed')),
  stripe_checkout_session_id text unique,
  input_hash text check (input_hash is null or input_hash ~ '^sha256:[a-f0-9]{64}$'),
  report jsonb,
  failure_code text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'not_configured', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status in ('awaiting_payment', 'paid', 'processing') and report is null and failure_code is null and completed_at is null)
    or (status = 'completed' and report is not null and failure_code is null and completed_at is not null)
    or (status = 'failed' and report is null and failure_code is not null and completed_at is not null)
  )
);

create index if not exists mps_preflight_orders_status_created_at_idx
  on public.mps_preflight_orders (status, created_at desc);

alter table public.mps_preflight_orders enable row level security;

-- No public policies: reports are accessed only through the token-checked application routes.
