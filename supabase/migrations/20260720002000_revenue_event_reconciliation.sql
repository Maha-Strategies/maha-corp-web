-- Verified Stripe events are reconciled into the private revenue ledger only
-- after the product-specific webhook has accepted them. This ledger has no
-- Stripe credential or payment authority; it records independently verifiable
-- commercial facts and makes event retries safe.

alter table public.revenue_opportunities drop constraint if exists revenue_opportunities_status_check;
alter table public.revenue_opportunities add constraint revenue_opportunities_status_check check (status in (
  'routed', 'awaiting_human_review', 'checkout_started', 'paid', 'delivered', 'partially_refunded', 'refunded', 'declined', 'closed_lost'
));
alter table public.revenue_opportunity_events drop constraint if exists revenue_opportunity_events_event_type_check;
alter table public.revenue_opportunity_events add constraint revenue_opportunity_events_event_type_check check (event_type in (
  'routed', 'human_review_started', 'checkout_started', 'paid', 'delivered', 'partially_refunded', 'refunded', 'declined', 'closed_lost'
));

create table if not exists public.revenue_stripe_webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null check (event_type ~ '^[a-z0-9_.]{1,128}$'),
  payload_hash text not null check (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  processing_result text not null check (processing_result in ('processed', 'ignored')),
  processed_at timestamptz not null
);

create table if not exists public.revenue_payment_reconciliations (
  opportunity_id text primary key references public.revenue_opportunities(public_id) on delete restrict,
  checkout_reference text not null unique check (char_length(checkout_reference) between 3 and 200),
  stripe_checkout_session_id text not null unique check (char_length(stripe_checkout_session_id) between 1 and 255),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id is null or char_length(stripe_payment_intent_id) between 1 and 255),
  gross_amount_cents integer not null check (gross_amount_cents > 0),
  refunded_amount_cents integer not null default 0 check (refunded_amount_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  paid_at timestamptz not null,
  delivered_at timestamptz
);

create table if not exists public.revenue_payment_reversals (
  stripe_reversal_id text primary key check (stripe_reversal_id ~ '^(re|du)_[A-Za-z0-9]+$'),
  opportunity_id text not null references public.revenue_opportunities(public_id) on delete restrict,
  stripe_event_id text not null unique references public.revenue_stripe_webhook_events(stripe_event_id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null
);

alter table public.revenue_stripe_webhook_events enable row level security;
alter table public.revenue_payment_reconciliations enable row level security;
alter table public.revenue_payment_reversals enable row level security;
revoke all on table public.revenue_stripe_webhook_events, public.revenue_payment_reconciliations, public.revenue_payment_reversals from public, anon, authenticated;
grant select, insert, update on table public.revenue_stripe_webhook_events, public.revenue_payment_reconciliations to service_role;
grant select, insert on table public.revenue_payment_reversals to service_role;

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
     or p_payload_hash !~ '^sha256:[a-f0-9]{64}$' or p_offer_id not in ('mps-prepaid-audit-access', 'mps-preflight', 'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species')
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
  insert into public.revenue_opportunity_events (opportunity_id,event_type,idempotency_hash,actor_fingerprint,reason,reference_id,metadata,created_at)
    values (v_opportunity_id,'routed','sha256:' || encode(digest(v_source_reference || ':routed','sha256'),'hex'),p_actor_fingerprint,'Verified Stripe checkout reconciled.',p_checkout_reference,jsonb_build_object('offerId',p_offer_id,'route','self_service_checkout'),p_received_at),
           (v_opportunity_id,'checkout_started','sha256:' || encode(digest(v_source_reference || ':checkout','sha256'),'hex'),p_actor_fingerprint,'Verified Stripe checkout session reconciled.',p_session_id,jsonb_build_object('stripeCheckoutSessionId',p_session_id),p_received_at),
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

create or replace function public.reconcile_revenue_payment_reversal(
  p_event_id text, p_event_type text, p_payload_hash text, p_reversal_id text, p_payment_intent_id text,
  p_amount_cents integer, p_currency text, p_actor_fingerprint text, p_received_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_event public.revenue_stripe_webhook_events%rowtype; v_payment public.revenue_payment_reconciliations%rowtype;
  v_total integer; v_event_type text;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_event_type not in ('refund.created','refund.updated','charge.dispute.closed')
     or p_payload_hash !~ '^sha256:[a-f0-9]{64}$' or p_reversal_id !~ '^(re|du)_[A-Za-z0-9]+$'
     or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$' or p_amount_cents is null or p_amount_cents < 1
     or p_currency !~ '^[A-Za-z]{3}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_received_at is null then
    raise exception 'Invalid revenue payment reversal.' using errcode = '22023';
  end if;
  select * into v_event from public.revenue_stripe_webhook_events where stripe_event_id=p_event_id for update;
  if found then if v_event.payload_hash <> p_payload_hash then raise exception 'Stripe event payload conflict.' using errcode='22023'; end if; return 'duplicate'; end if;
  select * into v_payment from public.revenue_payment_reconciliations where stripe_payment_intent_id=p_payment_intent_id for update;
  if not found then return 'retry'; end if;
  if v_payment.currency <> lower(p_currency) then return 'ignored'; end if;
  if exists (select 1 from public.revenue_payment_reversals where stripe_reversal_id=p_reversal_id) then
    insert into public.revenue_stripe_webhook_events values (p_event_id,p_event_type,p_payload_hash,'processed',p_received_at); return 'duplicate';
  end if;
  if p_amount_cents > v_payment.gross_amount_cents - v_payment.refunded_amount_cents then return 'ignored'; end if;
  insert into public.revenue_stripe_webhook_events values (p_event_id,p_event_type,p_payload_hash,'processed',p_received_at);
  insert into public.revenue_payment_reversals (stripe_reversal_id,opportunity_id,stripe_event_id,amount_cents,currency,created_at)
    values (p_reversal_id,v_payment.opportunity_id,p_event_id,p_amount_cents,lower(p_currency),p_received_at);
  v_total := v_payment.refunded_amount_cents + p_amount_cents;
  v_event_type := case when v_total >= v_payment.gross_amount_cents then 'refunded' else 'partially_refunded' end;
  update public.revenue_payment_reconciliations set refunded_amount_cents=v_total where opportunity_id=v_payment.opportunity_id;
  insert into public.revenue_opportunity_events (opportunity_id,event_type,idempotency_hash,actor_fingerprint,reason,reference_id,amount_cents,currency,metadata,created_at)
    values (v_payment.opportunity_id,v_event_type,'sha256:' || encode(digest('reversal:' || p_reversal_id,'sha256'),'hex'),p_actor_fingerprint,'Verified Stripe payment reversal reconciled.',p_reversal_id,p_amount_cents,lower(p_currency),jsonb_build_object('stripeEventId',p_event_id,'stripePaymentIntentId',p_payment_intent_id),p_received_at);
  update public.revenue_opportunities set status=v_event_type,updated_at=p_received_at where public_id=v_payment.opportunity_id;
  return 'processed';
end;
$$;

create or replace function public.record_revenue_checkout_delivery(
  p_offer_id text, p_checkout_reference text, p_reference_id text, p_actor_fingerprint text, p_delivered_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_payment public.revenue_payment_reconciliations%rowtype; v_hash text;
begin
  if p_offer_id not in ('mps-preflight') or char_length(p_checkout_reference) not between 3 and 200 or char_length(p_reference_id) not between 3 and 200
     or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_delivered_at is null then raise exception 'Invalid revenue delivery reconciliation.' using errcode='22023'; end if;
  select r.* into v_payment from public.revenue_payment_reconciliations r join public.revenue_opportunities o on o.public_id=r.opportunity_id
    where r.checkout_reference=p_checkout_reference and o.offer_id=p_offer_id for update;
  if not found then return 'retry'; end if;
  if v_payment.delivered_at is not null then return 'duplicate'; end if;
  v_hash := 'sha256:' || encode(digest('delivery:' || p_checkout_reference,'sha256'),'hex');
  insert into public.revenue_opportunity_events (opportunity_id,event_type,idempotency_hash,actor_fingerprint,reason,reference_id,metadata,created_at)
    values (v_payment.opportunity_id,'delivered',v_hash,p_actor_fingerprint,'Purchased preflight report completed.',p_reference_id,'{}'::jsonb,p_delivered_at);
  update public.revenue_payment_reconciliations set delivered_at=p_delivered_at where opportunity_id=v_payment.opportunity_id;
  update public.revenue_opportunities set status='delivered',updated_at=p_delivered_at where public_id=v_payment.opportunity_id;
  return 'processed';
end;
$$;

revoke all on function public.reconcile_revenue_checkout_payment(text,text,text,text,text,text,text,integer,text,boolean,text,timestamptz) from public, anon, authenticated;
revoke all on function public.reconcile_revenue_payment_reversal(text,text,text,text,text,integer,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_revenue_checkout_delivery(text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.reconcile_revenue_checkout_payment(text,text,text,text,text,text,text,integer,text,boolean,text,timestamptz) to service_role;
grant execute on function public.reconcile_revenue_payment_reversal(text,text,text,text,text,integer,text,text,timestamptz) to service_role;
grant execute on function public.record_revenue_checkout_delivery(text,text,text,text,timestamptz) to service_role;
