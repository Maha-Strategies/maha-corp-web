-- Records which client owns which book. Book content is static; only ownership
-- is dynamic. The write path (Stripe book checkout / operator grant) ships in a
-- later phase; this migration provides only the store the read endpoint queries.
create table if not exists public.book_entitlements (
  public_id text primary key check (public_id ~ '^bent_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  book_id text not null check (book_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  source_type text not null check (source_type in ('stripe_checkout', 'operator_grant', 'bundle')),
  source_id text not null check (char_length(source_id) between 1 and 200),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- A client owns a given book at most once; re-grants update the same row.
  unique (client_id, book_id)
);

create index if not exists book_entitlements_client_book_idx
  on public.book_entitlements (client_id, book_id)
  where revoked_at is null;

alter table public.book_entitlements enable row level security;

-- No public policies: the service-role API routes are the only readers/writers,
-- matching every other agent table. Explicit least-privilege grants (see
-- 20260718001300) rather than reliance on platform default privileges.
revoke all on table public.book_entitlements from public, anon, authenticated;
grant select, insert, update on table public.book_entitlements to service_role;
