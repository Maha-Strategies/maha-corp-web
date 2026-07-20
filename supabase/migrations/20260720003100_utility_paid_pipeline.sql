-- Paid, no-login "pay-then-run" pipeline for self-serve micro-utilities.
-- A checkout is a single-use run token: the buyer pays, then the success page
-- posts the receipts it held in the browser to the run endpoint, which consumes
-- the token exactly once. Revenue is reconciled through the existing revenue
-- control plane via a new 'utility-receipts-to-csv' offer.

-- 1. Register the utility offer in the revenue offer set (two places).
alter table public.revenue_opportunities drop constraint if exists revenue_opportunities_offer_id_check;
alter table public.revenue_opportunities
  add constraint revenue_opportunities_offer_id_check check (offer_id in (
    'mps-prepaid-audit-access', 'mps-preflight',
    'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species',
    'rapid-intelligence-brief', 'verified-research-brief',
    'utility-receipts-to-csv'
  ));

-- Verbatim copy of the original reconcile_revenue_checkout_payment (migration
-- 20260720002000), with the ONLY change being 'utility-receipts-to-csv' added
-- to the offer allowlist. Do not otherwise edit — the books/MPS flows call this.
create or replace function public.reconcile_revenue_checkout_payment(
  p_event_id text, p_event_type text, p_payload_hash text, p_offer_id text, p_checkout_reference text,
  p_session_id text, p_payment_intent_id text, p_amount_cents integer, p_currency text, p_delivered boolean,
  p_actor_fingerprint text, p_received_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_event public.revenue_stripe_webhook_events%rowtype; v_opportunity public.revenue_opportunities%rowtype;
  v_payment public.revenue_payment_reconciliations%rowtype; v_opportunity_id text; v_source_reference text;
  v_hash text; v_delivered_at timestamptz;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
     or p_payload_hash !~ '^sha256:[a-f0-9]{64}$' or p_offer_id not in ('mps-prepaid-audit-access', 'mps-preflight', 'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species', 'utility-receipts-to-csv')
     or char_length(p_checkout_reference) not between 3 and 200 or char_length(p_session_id) not between 1 and 255
     or (p_payment_intent_id is not null and char_length(p_payment_intent_id) not between 1 and 255)
     or p_amount_cents is null or p_amount_cents < 1 or p_currency !~ '^[A-Za-z]{3}$'
     or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_received_at is null then
    raise exception 'Invalid revenue checkout reconciliation.' using errcode = '22023';
  end if;
  select * into v_event from public.revenue_stripe_webhook_events where stripe_event_id = p_event_id for update;
  if found then
    if v_event.payload_hash <> p_payload_hash then raise exception 'Stripe event payload conflict.' using errcode = '22023'; end if;
    return 'duplicate';
  end if;
  select * into v_payment from public.revenue_payment_reconciliations where checkout_reference = p_checkout_reference for update;
  if found then
    if v_payment.stripe_checkout_session_id <> p_session_id or v_payment.stripe_payment_intent_id is distinct from p_payment_intent_id
       or v_payment.gross_amount_cents <> p_amount_cents or v_payment.currency <> lower(p_currency) then
      raise exception 'Checkout reconciliation conflict.' using errcode = '22023';
    end if;
    insert into public.revenue_stripe_webhook_events values (p_event_id,p_event_type,p_payload_hash,'processed',p_received_at);
    return 'duplicate';
  end if;
  v_source_reference := 'stripe:' || p_offer_id || ':' || p_checkout_reference;
  v_opportunity_id := 'revopp_' || replace(gen_random_uuid()::text, '-', '');
  v_hash := 'sha256:' || encode(digest(v_source_reference, 'sha256'), 'hex');
  insert into public.revenue_opportunities (public_id, source_type, source_reference, offer_id, signal_hash, route, qualified, qualification_reasons, status, created_at, updated_at)
    values (v_opportunity_id, 'manual_operator', v_source_reference, p_offer_id, v_hash, 'self_service_checkout', true, array['verified_stripe_checkout'], case when p_delivered then 'delivered' else 'paid' end, p_received_at, p_received_at);
  -- FIX (bug in 20260720002000): the shared 8-column list could not hold the
  -- 'paid' row's amount/currency, so the multi-row VALUES had inconsistent
  -- arity and threw on the first real reconciliation. 10-column list; the
  -- non-paid rows carry NULL amount/currency.
  insert into public.revenue_opportunity_events (opportunity_id,event_type,idempotency_hash,actor_fingerprint,reason,reference_id,amount_cents,currency,metadata,created_at)
    values (v_opportunity_id,'routed','sha256:' || encode(digest(v_source_reference || ':routed','sha256'),'hex'),p_actor_fingerprint,'Verified Stripe checkout reconciled.',p_checkout_reference,null,null,jsonb_build_object('offerId',p_offer_id,'route','self_service_checkout'),p_received_at),
           (v_opportunity_id,'checkout_started','sha256:' || encode(digest(v_source_reference || ':checkout','sha256'),'hex'),p_actor_fingerprint,'Verified Stripe checkout session reconciled.',p_session_id,null,null,jsonb_build_object('stripeCheckoutSessionId',p_session_id),p_received_at),
           (v_opportunity_id,'paid','sha256:' || encode(digest(v_source_reference || ':paid','sha256'),'hex'),p_actor_fingerprint,'Verified Stripe payment reconciled.',p_event_id,p_amount_cents,lower(p_currency),jsonb_build_object('stripeCheckoutSessionId',p_session_id,'stripePaymentIntentId',p_payment_intent_id),p_received_at);
  if p_delivered then
    insert into public.revenue_opportunity_events (opportunity_id,event_type,idempotency_hash,actor_fingerprint,reason,reference_id,metadata,created_at)
      values (v_opportunity_id,'delivered','sha256:' || encode(digest(v_source_reference || ':delivered','sha256'),'hex'),p_actor_fingerprint,'Entitlement was issued by the verified product webhook.',p_checkout_reference,'{}'::jsonb,p_received_at);
    v_delivered_at := p_received_at;
  end if;
  insert into public.revenue_payment_reconciliations (opportunity_id,checkout_reference,stripe_checkout_session_id,stripe_payment_intent_id,gross_amount_cents,currency,paid_at,delivered_at)
    values (v_opportunity_id,p_checkout_reference,p_session_id,p_payment_intent_id,p_amount_cents,lower(p_currency),p_received_at,v_delivered_at);
  insert into public.revenue_stripe_webhook_events values (p_event_id,p_event_type,p_payload_hash,'processed',p_received_at);
  return 'processed';
end;
$$;

-- 2. The single-use checkout / run token.
create table if not exists public.utility_checkouts (
  public_id text primary key check (public_id ~ '^util_checkout_[a-f0-9]{32}$'),
  utility text not null check (utility ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  request_hash text not null unique check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  stripe_payment_amount integer check (stripe_payment_amount is null or stripe_payment_amount > 0),
  stripe_payment_currency text check (stripe_payment_currency is null or stripe_payment_currency ~ '^[a-z]{3}$'),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'failed')),
  run_status text not null default 'unused' check (run_status in ('unused', 'consumed', 'refunded')),
  failure_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  run_at timestamptz
);
create index if not exists utility_checkouts_pi_idx on public.utility_checkouts (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Webhook: mark a checkout paid exactly once. Idempotent via the paid state.
create or replace function public.process_utility_checkout_event(
  p_checkout_id text, p_session_id text, p_payment_intent_id text, p_amount integer, p_currency text, p_received_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.utility_checkouts%rowtype;
begin
  if p_checkout_id is null or p_checkout_id !~ '^util_checkout_[a-f0-9]{32}$'
     or p_session_id is null or char_length(p_session_id) not between 1 and 255
     or p_amount is null or p_amount <= 0 or p_currency is null or p_currency !~ '^[A-Za-z]{3}$' or p_received_at is null then
    raise exception 'Invalid utility checkout event.' using errcode = '22023';
  end if;

  select * into v from public.utility_checkouts where public_id = p_checkout_id for update;
  if not found then return 'retry'; end if;
  if v.status = 'failed' or (v.stripe_checkout_session_id is not null and v.stripe_checkout_session_id <> p_session_id) then
    return 'ignored';
  end if;
  if v.status = 'paid' then return 'duplicate'; end if;

  update public.utility_checkouts
    set status = 'paid', stripe_checkout_session_id = p_session_id, stripe_payment_intent_id = p_payment_intent_id,
        stripe_payment_amount = p_amount, stripe_payment_currency = lower(p_currency), paid_at = p_received_at
    where public_id = p_checkout_id;
  return 'processed';
end;
$$;

-- Run: claim the single use atomically BEFORE the fallible worker runs.
create or replace function public.claim_utility_run(p_checkout_id text, p_run_at timestamptz)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.utility_checkouts%rowtype;
begin
  if p_checkout_id is null or p_checkout_id !~ '^util_checkout_[a-f0-9]{32}$' or p_run_at is null then
    raise exception 'Invalid utility run claim.' using errcode = '22023';
  end if;
  select * into v from public.utility_checkouts where public_id = p_checkout_id for update;
  if not found then return 'not_found'; end if;
  if v.status <> 'paid' then return 'not_paid'; end if;
  if v.run_status = 'consumed' then return 'already_consumed'; end if;
  if v.run_status = 'refunded' then return 'refunded'; end if;
  update public.utility_checkouts set run_status = 'consumed', run_at = p_run_at where public_id = p_checkout_id;
  return 'claimed';
end;
$$;

-- Auto-refund path: flip a consumed run back to refunded (worker failed).
create or replace function public.mark_utility_run_refunded(p_checkout_id text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.utility_checkouts set run_status = 'refunded' where public_id = p_checkout_id and run_status = 'consumed';
  return case when found then 'refunded' else 'noop' end;
end;
$$;

alter table public.utility_checkouts enable row level security;
revoke all on table public.utility_checkouts from public, anon, authenticated;
grant select, insert, update on table public.utility_checkouts to service_role;

revoke all on function public.process_utility_checkout_event(text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_utility_run(text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_utility_run_refunded(text) from public, anon, authenticated;
grant execute on function public.process_utility_checkout_event(text, text, text, integer, text, timestamptz) to service_role;
grant execute on function public.claim_utility_run(text, timestamptz) to service_role;
grant execute on function public.mark_utility_run_refunded(text) to service_role;
