-- Book purchase write-pipeline: pending checkouts, the books webhook processor,
-- and the transactional entitlement minting function. Identity is never taken
-- from Stripe metadata — the webhook resolves a locally-created checkout row,
-- exactly like the credits pipeline.

-- The webhook event claim table now serves two processors.
alter table public.stripe_webhook_events drop constraint if exists stripe_webhook_events_processor_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_processor_check
  check (processor in ('mps_credits', 'books'));

create table if not exists public.book_checkouts (
  public_id text primary key check (public_id ~ '^book_checkout_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  book_id text not null check (book_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_payment_amount integer check (stripe_payment_amount is null or stripe_payment_amount > 0),
  stripe_payment_currency text check (stripe_payment_currency is null or stripe_payment_currency ~ '^[a-z]{3}$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
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

create index if not exists book_checkouts_client_created_at_idx
  on public.book_checkouts (client_id, created_at desc);

alter table public.book_checkouts enable row level security;
revoke all on table public.book_checkouts from public, anon, authenticated;
grant select, insert, update on table public.book_checkouts to service_role;

-- Records non-processed books-processor events (unhandled types, unpaid
-- sessions, malformed payloads) with the same event-level idempotency claim.
create or replace function public.record_book_webhook_event(
  p_event_id text,
  p_event_type text,
  p_object_id text,
  p_payload_hash text,
  p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_event_type is null or p_event_type !~ '^[a-z0-9_.]{1,128}$'
     or (p_object_id is not null and char_length(p_object_id) not between 1 and 255)
     or p_payload_hash is null or p_payload_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_received_at is null then
    raise exception 'Invalid Stripe webhook event.' using errcode = '22023';
  end if;

  insert into public.stripe_webhook_events
    (stripe_event_id, event_type, object_id, processor, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_object_id, 'books', p_payload_hash, 'ignored', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then return 'duplicate'; end if;
  return 'ignored';
end;
$$;

-- Claim the Stripe event and mint the book entitlement in one transaction so
-- neither can commit alone. A revoked entitlement is restored, never duplicated.
create or replace function public.process_book_checkout_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_checkout_id text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_entitlement_id text,
  p_allowed_price_ids text[],
  p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_checkout public.book_checkouts%rowtype;
  v_client_status text;
  v_inserted integer;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_event_type is null
     or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
     or p_payload_hash is null or p_payload_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_checkout_id is null or p_checkout_id !~ '^book_checkout_[a-f0-9]{32}$'
     or p_session_id is null or char_length(p_session_id) not between 1 and 255
     or (p_payment_intent_id is not null and char_length(p_payment_intent_id) not between 1 and 255)
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_currency !~ '^[A-Za-z]{3}$'
     or p_entitlement_id is null or p_entitlement_id !~ '^bent_[a-f0-9]{32}$'
     or p_allowed_price_ids is null or cardinality(p_allowed_price_ids) < 1
     or p_received_at is null then
    raise exception 'Invalid Stripe book checkout event.' using errcode = '22023';
  end if;

  select * into v_checkout
    from public.book_checkouts
    where public_id = p_checkout_id
    for update;
  if not found then return 'retry'; end if;

  insert into public.stripe_webhook_events
    (stripe_event_id, event_type, object_id, processor, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_session_id, 'books', p_payload_hash, 'processed', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;

  if v_checkout.status = 'failed'
     or (v_checkout.stripe_checkout_session_id is not null
         and v_checkout.stripe_checkout_session_id <> p_session_id)
     or not (v_checkout.stripe_price_id = any(p_allowed_price_ids)) then
    update public.stripe_webhook_events set processing_result = 'ignored'
      where stripe_event_id = p_event_id;
    return 'ignored';
  end if;

  if v_checkout.status = 'paid' then
    if v_checkout.stripe_checkout_session_id is distinct from p_session_id
       or v_checkout.stripe_payment_intent_id is distinct from p_payment_intent_id
       or v_checkout.stripe_payment_amount is distinct from p_amount
       or v_checkout.stripe_payment_currency is distinct from lower(p_currency) then
      update public.stripe_webhook_events set processing_result = 'ignored'
        where stripe_event_id = p_event_id;
      return 'ignored';
    end if;
    return 'processed';
  end if;

  select status into v_client_status
    from public.agent_clients
    where public_id = v_checkout.client_id
    for update;
  if not found or v_client_status <> 'active' then
    update public.stripe_webhook_events set processing_result = 'ignored'
      where stripe_event_id = p_event_id;
    return 'ignored';
  end if;

  insert into public.book_entitlements
    (public_id, client_id, book_id, source_type, source_id, granted_at)
  values
    (p_entitlement_id, v_checkout.client_id, v_checkout.book_id, 'stripe_checkout', p_event_id, p_received_at)
  on conflict (client_id, book_id) do update
    set revoked_at = null,
        source_type = 'stripe_checkout',
        source_id = excluded.source_id,
        granted_at = excluded.granted_at;

  update public.book_checkouts
    set status = 'paid',
        stripe_checkout_session_id = p_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        stripe_payment_amount = p_amount,
        stripe_payment_currency = lower(p_currency),
        paid_at = p_received_at
    where public_id = p_checkout_id;

  return 'processed';
end;
$$;

revoke all on function public.record_book_webhook_event(text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.process_book_checkout_event(text,text,text,text,text,text,integer,text,text,text[],timestamptz) from public, anon, authenticated;
grant execute on function public.record_book_webhook_event(text,text,text,text,timestamptz) to service_role;
grant execute on function public.process_book_checkout_event(text,text,text,text,text,text,integer,text,text,text[],timestamptz) to service_role;
