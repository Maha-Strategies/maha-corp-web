-- Book entitlements are revoked only after money is actually reversed. Stripe
-- can emit multiple event deliveries for one refund and can split a refund
-- across several refund objects, so record payment reversals independently of
-- the webhook-event claim table and sum them under the checkout lock.
create table if not exists public.book_payment_reversals (
  stripe_reversal_id text primary key check (stripe_reversal_id ~ '^(re|du)_[A-Za-z0-9]+$'),
  checkout_id text not null references public.book_checkouts(public_id) on delete restrict,
  reversal_type text not null check (reversal_type in ('refund', 'dispute_lost')),
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  stripe_event_id text not null unique references public.stripe_webhook_events(stripe_event_id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists book_payment_reversals_checkout_idx
  on public.book_payment_reversals (checkout_id);

alter table public.book_payment_reversals enable row level security;
revoke all on table public.book_payment_reversals from public, anon, authenticated;
grant select, insert on table public.book_payment_reversals to service_role;

create or replace function public.process_book_payment_reversal_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_reversal_id text,
  p_reversal_type text,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_checkout public.book_checkouts%rowtype;
  v_inserted integer;
  v_reversed_amount integer;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$'
     or p_event_type is null or p_event_type not in ('refund.created', 'refund.updated', 'charge.dispute.closed')
     or p_payload_hash is null or p_payload_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_reversal_id is null or p_reversal_id !~ '^(re|du)_[A-Za-z0-9]+$'
     or p_reversal_type is null or p_reversal_type not in ('refund', 'dispute_lost')
     or p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_currency !~ '^[A-Za-z]{3}$'
     or p_received_at is null then
    raise exception 'Invalid Stripe book payment reversal event.' using errcode = '22023';
  end if;

  select * into v_checkout
    from public.book_checkouts
    where stripe_payment_intent_id = p_payment_intent_id
    for update;
  if not found or v_checkout.status = 'awaiting_payment' then return 'retry'; end if;
  if v_checkout.status = 'failed' then return 'ignored'; end if;
  if v_checkout.stripe_payment_currency <> lower(p_currency) then return 'ignored'; end if;

  insert into public.stripe_webhook_events
    (stripe_event_id, event_type, object_id, processor, payload_hash, processing_result, processed_at)
  values
    (p_event_id, p_event_type, p_reversal_id, 'books', p_payload_hash, 'processed', p_received_at)
  on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;

  insert into public.book_payment_reversals
    (stripe_reversal_id, checkout_id, reversal_type, amount, currency, stripe_event_id, created_at)
  values
    (p_reversal_id, v_checkout.public_id, p_reversal_type, p_amount, lower(p_currency), p_event_id, p_received_at)
  on conflict (stripe_reversal_id) do nothing;

  select coalesce(sum(amount), 0) into v_reversed_amount
    from public.book_payment_reversals
    where checkout_id = v_checkout.public_id;

  -- Partial refunds preserve access. A full reversal, including a lost
  -- dispute, revokes the entitlement in this same transaction.
  if v_reversed_amount >= v_checkout.stripe_payment_amount then
    update public.book_entitlements
      set revoked_at = p_received_at
      where client_id = v_checkout.client_id
        and book_id = v_checkout.book_id
        and revoked_at is null;
  end if;

  return 'processed';
end;
$$;

revoke all on function public.process_book_payment_reversal_event(text,text,text,text,text,text,integer,text,timestamptz) from public, anon, authenticated;
grant execute on function public.process_book_payment_reversal_event(text,text,text,text,text,text,integer,text,timestamptz) to service_role;
