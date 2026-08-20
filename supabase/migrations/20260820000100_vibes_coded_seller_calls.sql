-- Durable, body-free state for the bounded Vibes-Coded seller adapter.
-- Source documents, required evidence text, compiled context, call tickets,
-- and response bodies are deliberately absent. Recovery recomputes the
-- deterministic artifact from the caller's same request and the stored hashes.

create table if not exists public.vibes_coded_seller_calls (
  client_request_id text primary key check (char_length(client_request_id) between 8 and 120),
  sku_slug text not null check (sku_slug = 'governed-context-verification-pack'),
  method text not null check (method = 'POST'),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  amount_cents integer not null check (amount_cents = 50),
  ticket_hash text not null check (ticket_hash ~ '^[a-f0-9]{64}$'),
  delivery_id text not null unique check (delivery_id ~ '^receipt_[a-f0-9]{32}$'),
  state text not null check (state in ('verifying', 'verification_pending', 'paid', 'delivery_pending', 'delivered', 'rejected')),
  output_hash text check (output_hash is null or output_hash ~ '^sha256:[a-f0-9]{64}$'),
  response_sha256 text check (response_sha256 is null or response_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  receipt_attempts integer not null default 0 check (receipt_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_slug, request_hash)
);

create index if not exists vibes_coded_seller_calls_state_idx
  on public.vibes_coded_seller_calls (state, updated_at desc);

alter table public.vibes_coded_seller_calls enable row level security;
revoke all on table public.vibes_coded_seller_calls from public, anon, authenticated;
grant select, insert, update on table public.vibes_coded_seller_calls to service_role;
revoke delete, truncate on table public.vibes_coded_seller_calls from service_role;

create or replace function public.admit_vibes_coded_seller_call(
  p_client_request_id text,
  p_sku_slug text,
  p_method text,
  p_request_hash text,
  p_amount_cents integer,
  p_ticket_hash text,
  p_delivery_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  existing public.vibes_coded_seller_calls%rowtype;
begin
  if p_sku_slug <> 'governed-context-verification-pack'
    or p_method <> 'POST'
    or p_amount_cents <> 50
    or p_request_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_ticket_hash !~ '^[a-f0-9]{64}$'
    or p_delivery_id !~ '^receipt_[a-f0-9]{32}$'
  then raise exception 'Invalid Vibes-Coded seller admission.' using errcode = '22023'; end if;

  select * into existing
    from public.vibes_coded_seller_calls
    where client_request_id = p_client_request_id
    for update;

  if found then
    if existing.sku_slug <> p_sku_slug
      or existing.method <> p_method
      or existing.request_hash <> p_request_hash
      or existing.amount_cents <> p_amount_cents
    then
      return jsonb_build_object('kind', 'conflict');
    end if;
    if existing.state = 'verifying' then
      return jsonb_build_object('kind', 'in_progress', 'record', to_jsonb(existing));
    end if;
    return jsonb_build_object('kind', 'existing', 'record', to_jsonb(existing));
  end if;

  insert into public.vibes_coded_seller_calls
    (client_request_id, sku_slug, method, request_hash, amount_cents, ticket_hash, delivery_id, state)
  values
    (p_client_request_id, p_sku_slug, p_method, p_request_hash, p_amount_cents, p_ticket_hash, p_delivery_id, 'verifying');
  select * into existing from public.vibes_coded_seller_calls where client_request_id = p_client_request_id;
  return jsonb_build_object('kind', 'claimed', 'record', to_jsonb(existing));
exception when unique_violation then
  select * into existing from public.vibes_coded_seller_calls where client_request_id = p_client_request_id;
  if found and existing.request_hash = p_request_hash then
    return jsonb_build_object('kind', 'in_progress', 'record', to_jsonb(existing));
  end if;
  return jsonb_build_object('kind', 'conflict');
end;
$$;

revoke all on function public.admit_vibes_coded_seller_call(text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.admit_vibes_coded_seller_call(text, text, text, text, integer, text, text) to service_role;

comment on table public.vibes_coded_seller_calls is
  'Body-free idempotency and delivery state for the unpublished Governed Context Verification Pack. Raw call tickets are never retained; recovery recomputes from the same caller-supplied request and hashes.';
