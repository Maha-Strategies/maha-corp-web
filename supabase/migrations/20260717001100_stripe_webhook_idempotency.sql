-- Stripe can deliver the same event more than once and does not guarantee
-- ordering across event types. Claim the Stripe event and change the credit
-- ledger in the same PostgreSQL transaction so neither can commit alone.
create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null check (event_type ~ '^[a-z0-9_.]{1,128}$'),
  object_id text check (object_id is null or char_length(object_id) between 1 and 255),
  processor text not null default 'mps_credits' check (processor = 'mps_credits'),
  payload_hash text not null check (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  processing_result text not null check (processing_result in ('processed', 'ignored')),
  processed_at timestamptz not null default now()
);

-- A PaymentIntent belongs to one Checkout Session. Enforcing that relationship
-- makes refund-to-checkout resolution deterministic.
create unique index if not exists mps_credit_checkouts_stripe_payment_intent_id_key
  on public.mps_credit_checkouts (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.record_mps_credit_webhook_event(
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
    (stripe_event_id, event_type, object_id, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_object_id, p_payload_hash, 'ignored', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then return 'duplicate'; end if;
  return 'ignored';
end;
$$;

create or replace function public.process_mps_credit_checkout_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_checkout_id text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_entry_id text,
  p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_checkout public.mps_credit_checkouts%rowtype;
  v_credential public.agent_client_credentials%rowtype;
  v_inserted integer;
  v_event_hash text;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_event_type is null
     or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
     or p_payload_hash is null or p_payload_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_checkout_id is null or p_checkout_id !~ '^credit_checkout_[a-f0-9]{32}$'
     or p_session_id is null or char_length(p_session_id) not between 1 and 255
     or (p_payment_intent_id is not null and char_length(p_payment_intent_id) not between 1 and 255)
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_currency !~ '^[A-Za-z]{3}$'
     or p_entry_id is null or p_entry_id !~ '^credit_[a-f0-9]{32}$'
     or p_received_at is null then
    raise exception 'Invalid Stripe checkout event.' using errcode = '22023';
  end if;

  select * into v_checkout
    from public.mps_credit_checkouts
    where public_id = p_checkout_id
    for update;
  if not found then return 'retry'; end if;

  insert into public.stripe_webhook_events
    (stripe_event_id, event_type, object_id, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_session_id, p_payload_hash, 'processed', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;

  if v_checkout.status = 'failed'
     or (v_checkout.stripe_checkout_session_id is not null
         and v_checkout.stripe_checkout_session_id <> p_session_id) then
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

  select * into v_credential
    from public.agent_client_credentials
    where public_id = v_checkout.credential_id
    for update;
  if not found or v_credential.billing_mode <> 'prepaid' or v_credential.status <> 'pending_payment' then
    update public.stripe_webhook_events set processing_result = 'ignored'
      where stripe_event_id = p_event_id;
    return 'ignored';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_checkout.client_id, 0));
  v_event_hash := 'sha256:' || encode(digest(
    p_entry_id || '|' || v_checkout.client_id || '|' || v_checkout.public_id || '|'
      || v_checkout.credit_quantity::text || '|' || p_session_id || '|' || p_received_at::text,
    'sha256'
  ), 'hex');

  insert into public.mps_credit_ledger_entries
    (public_id, client_id, checkout_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
  values
    (p_entry_id, v_checkout.client_id, v_checkout.public_id, 'purchase_grant', 'mps_audit_invocation',
     v_checkout.credit_quantity, 'stripe_checkout_session', p_session_id, v_event_hash,
     jsonb_build_object(
       'stripeEventId', p_event_id,
       'stripePriceId', v_checkout.stripe_price_id,
       'stripePaymentIntentId', p_payment_intent_id,
       'stripePaymentAmount', p_amount,
       'stripePaymentCurrency', lower(p_currency)
     ), p_received_at);

  update public.mps_credit_checkouts
    set status = 'paid',
        stripe_checkout_session_id = p_session_id,
        stripe_payment_intent_id = p_payment_intent_id,
        stripe_payment_amount = p_amount,
        stripe_payment_currency = lower(p_currency),
        paid_at = p_received_at
    where public_id = p_checkout_id;

  update public.agent_client_credentials
    set status = 'active'
    where public_id = v_checkout.credential_id
      and status = 'pending_payment'
      and billing_mode = 'prepaid';

  return 'processed';
end;
$$;

create or replace function public.process_mps_credit_refund_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_refund_id text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_entry_id text,
  p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_checkout public.mps_credit_checkouts%rowtype;
  v_inserted integer;
  v_already_reversed numeric(18, 6);
  v_requested_reversal numeric(18, 6);
  v_reversal_quantity numeric(18, 6);
  v_event_hash text;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_event_type is null
     or p_event_type not in ('refund.created', 'refund.updated')
     or p_payload_hash is null or p_payload_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_refund_id is null or char_length(p_refund_id) not between 1 and 255
     or p_payment_intent_id is null or char_length(p_payment_intent_id) not between 1 and 255
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_currency !~ '^[A-Za-z]{3}$'
     or p_entry_id is null or p_entry_id !~ '^credit_[a-f0-9]{32}$'
     or p_received_at is null then
    raise exception 'Invalid Stripe refund event.' using errcode = '22023';
  end if;

  select * into v_checkout
    from public.mps_credit_checkouts
    where stripe_payment_intent_id = p_payment_intent_id
    for update;
  if not found or v_checkout.status = 'awaiting_payment' then return 'retry'; end if;

  insert into public.stripe_webhook_events
    (stripe_event_id, event_type, object_id, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_refund_id, p_payload_hash, 'processed', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;

  if v_checkout.status <> 'paid'
     or v_checkout.stripe_payment_amount is null
     or v_checkout.stripe_payment_currency is null
     or v_checkout.stripe_payment_currency <> lower(p_currency)
     or p_amount > v_checkout.stripe_payment_amount then
    update public.stripe_webhook_events set processing_result = 'ignored'
      where stripe_event_id = p_event_id;
    return 'ignored';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_checkout.client_id, 0));
  if exists (
    select 1 from public.mps_credit_ledger_entries
    where source_type = 'stripe_refund' and source_id = p_refund_id
  ) then
    update public.stripe_webhook_events set processing_result = 'ignored'
      where stripe_event_id = p_event_id;
    return 'ignored';
  end if;

  select coalesce(sum(abs(quantity)), 0) into v_already_reversed
    from public.mps_credit_ledger_entries
    where checkout_id = v_checkout.public_id
      and entry_type = 'reversal'
      and source_type = 'stripe_refund';

  v_requested_reversal := round(
    v_checkout.credit_quantity::numeric * p_amount::numeric / v_checkout.stripe_payment_amount::numeric,
    6
  );
  v_reversal_quantity := least(
    greatest(v_checkout.credit_quantity::numeric - v_already_reversed, 0),
    v_requested_reversal
  );
  if v_reversal_quantity <= 0 then return 'processed'; end if;

  v_event_hash := 'sha256:' || encode(digest(
    p_entry_id || '|' || v_checkout.client_id || '|' || v_checkout.public_id || '|'
      || (-v_reversal_quantity)::text || '|' || p_refund_id || '|' || p_received_at::text,
    'sha256'
  ), 'hex');

  insert into public.mps_credit_ledger_entries
    (public_id, client_id, checkout_id, entry_type, unit, quantity, source_type, source_id, event_hash, metadata, created_at)
  values
    (p_entry_id, v_checkout.client_id, v_checkout.public_id, 'reversal', 'mps_audit_invocation',
     -v_reversal_quantity, 'stripe_refund', p_refund_id, v_event_hash,
     jsonb_build_object(
       'stripeEventId', p_event_id,
       'stripePaymentIntentId', p_payment_intent_id,
       'stripeRefundId', p_refund_id,
       'stripeRefundAmount', p_amount,
       'stripeRefundCurrency', lower(p_currency)
     ), p_received_at);

  return 'processed';
end;
$$;

-- Remove the pre-event-ID purchase finalizer so future callers cannot bypass
-- the atomic event claim.
drop function if exists public.finalize_mps_credit_purchase(text,text,text,integer,text,text,text,timestamptz);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update on table public.stripe_webhook_events to service_role;

revoke all on function public.record_mps_credit_webhook_event(text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.process_mps_credit_checkout_event(text,text,text,text,text,text,integer,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.process_mps_credit_refund_event(text,text,text,text,text,integer,text,text,timestamptz) from public, anon, authenticated;

grant execute on function public.record_mps_credit_webhook_event(text,text,text,text,timestamptz) to service_role;
grant execute on function public.process_mps_credit_checkout_event(text,text,text,text,text,text,integer,text,text,timestamptz) to service_role;
grant execute on function public.process_mps_credit_refund_event(text,text,text,text,text,integer,text,text,timestamptz) to service_role;
