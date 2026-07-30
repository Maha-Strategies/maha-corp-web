-- Durable billing state for prepaid Maha API credits. Redis remains the
-- low-latency consumption store; this ledger is the system of record for
-- Checkout creation, Stripe events, and payment reversals.
create table if not exists public.api_credit_checkouts (
  public_id text primary key check (public_id ~ '^api_credit_checkout_[a-f0-9]{32}$'),
  api_key_id text not null check (api_key_id ~ '^key_[A-Za-z0-9]+$'),
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  pack text not null check (pack in ('starter', 'pro', 'enterprise')),
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  credit_quantity integer not null check (credit_quantity > 0),
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text unique,
  stripe_payment_amount integer check (stripe_payment_amount is null or stripe_payment_amount > 0),
  stripe_payment_currency text check (stripe_payment_currency is null or stripe_payment_currency ~ '^[a-z]{3}$'),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'failed', 'reversed')),
  failure_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  reversed_at timestamptz,
  unique (api_key_id, request_hash)
);

create table if not exists public.api_credit_stripe_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null check (event_type ~ '^[a-z0-9_.]{1,128}$'),
  object_id text check (object_id is null or char_length(object_id) between 1 and 255),
  payload_hash text not null check (payload_hash ~ '^sha256:[a-f0-9]{64}$'),
  processing_result text not null check (processing_result in ('processed', 'ignored')),
  processed_at timestamptz not null default now()
);

create table if not exists public.api_credit_ledger_entries (
  public_id text primary key check (public_id ~ '^api_credit_[a-f0-9]{32}$'),
  checkout_id text not null references public.api_credit_checkouts(public_id) on delete restrict,
  entry_type text not null check (entry_type in ('purchase_grant', 'payment_reversal')),
  quantity integer not null check (quantity <> 0),
  stripe_event_id text not null unique references public.api_credit_stripe_events(stripe_event_id) on delete restrict,
  stripe_reversal_id text unique check (stripe_reversal_id is null or stripe_reversal_id ~ '^(re|du)_[A-Za-z0-9]+$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_credit_payment_reversals (
  stripe_reversal_id text primary key check (stripe_reversal_id ~ '^(re|du)_[A-Za-z0-9]+$'),
  checkout_id text not null references public.api_credit_checkouts(public_id) on delete restrict,
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  stripe_event_id text not null unique references public.api_credit_stripe_events(stripe_event_id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists api_credit_checkouts_key_created_idx on public.api_credit_checkouts (api_key_id, created_at desc);
create index if not exists api_credit_ledger_checkout_idx on public.api_credit_ledger_entries (checkout_id, created_at);

alter table public.api_credit_checkouts enable row level security;
alter table public.api_credit_stripe_events enable row level security;
alter table public.api_credit_ledger_entries enable row level security;
alter table public.api_credit_payment_reversals enable row level security;
revoke all on public.api_credit_checkouts, public.api_credit_stripe_events, public.api_credit_ledger_entries, public.api_credit_payment_reversals from public, anon, authenticated;
grant select, insert, update on public.api_credit_checkouts to service_role;
grant select, insert on public.api_credit_stripe_events, public.api_credit_ledger_entries to service_role;
grant select, insert on public.api_credit_payment_reversals to service_role;

create or replace function public.process_api_credit_checkout_event(
  p_event_id text, p_event_type text, p_payload_hash text, p_checkout_id text,
  p_session_id text, p_payment_intent_id text, p_amount integer, p_currency text,
  p_price_id text, p_entry_id text, p_received_at timestamptz
) returns text language plpgsql security invoker set search_path = public as $$
declare v_checkout public.api_credit_checkouts%rowtype; v_inserted integer;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    or p_payload_hash !~ '^sha256:[a-f0-9]{64}$' or p_checkout_id !~ '^api_credit_checkout_[a-f0-9]{32}$'
    or p_session_id is null or p_amount is null or p_amount <= 0 or p_currency !~ '^[A-Za-z]{3}$'
    or p_price_id !~ '^price_[A-Za-z0-9]+$' or p_entry_id !~ '^api_credit_[a-f0-9]{32}$' or p_received_at is null then
    raise exception 'Invalid API-credit Stripe event.' using errcode = '22023';
  end if;
  select * into v_checkout from public.api_credit_checkouts where public_id = p_checkout_id for update;
  if not found then return 'retry'; end if;
  insert into public.api_credit_stripe_events (stripe_event_id,event_type,object_id,payload_hash,processing_result,processed_at)
  values (p_event_id,p_event_type,p_session_id,p_payload_hash,'processed',p_received_at) on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  if v_checkout.status in ('failed','reversed') or v_checkout.stripe_price_id <> p_price_id
     or (v_checkout.stripe_checkout_session_id is not null and v_checkout.stripe_checkout_session_id <> p_session_id) then
    update public.api_credit_stripe_events set processing_result='ignored' where stripe_event_id=p_event_id; return 'ignored';
  end if;
  if v_checkout.status = 'paid' then
    if v_checkout.stripe_payment_intent_id is distinct from p_payment_intent_id or v_checkout.stripe_payment_amount is distinct from p_amount or v_checkout.stripe_payment_currency is distinct from lower(p_currency) then
      update public.api_credit_stripe_events set processing_result='ignored' where stripe_event_id=p_event_id; return 'ignored';
    end if;
    return 'already_paid';
  end if;
  insert into public.api_credit_ledger_entries (public_id,checkout_id,entry_type,quantity,stripe_event_id,metadata,created_at)
  values (p_entry_id,v_checkout.public_id,'purchase_grant',v_checkout.credit_quantity,p_event_id,jsonb_build_object('stripeSessionId',p_session_id,'stripePriceId',p_price_id,'amount',p_amount,'currency',lower(p_currency)),p_received_at);
  update public.api_credit_checkouts set status='paid',stripe_checkout_session_id=p_session_id,stripe_payment_intent_id=p_payment_intent_id,
    stripe_payment_amount=p_amount,stripe_payment_currency=lower(p_currency),paid_at=p_received_at where public_id=p_checkout_id;
  return 'processed';
end; $$;

create or replace function public.process_api_credit_reversal_event(
  p_event_id text, p_event_type text, p_payload_hash text, p_reversal_id text,
  p_payment_intent_id text, p_amount integer, p_currency text, p_entry_id text, p_received_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_checkout public.api_credit_checkouts%rowtype; v_inserted integer; v_total_reversed integer; v_new_total integer; v_quantity integer;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_event_type not in ('refund.created','refund.updated','charge.dispute.closed')
    or p_payload_hash !~ '^sha256:[a-f0-9]{64}$' or p_reversal_id !~ '^(re|du)_[A-Za-z0-9]+$'
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$' or p_amount is null or p_amount <= 0 or p_currency !~ '^[A-Za-z]{3}$'
    or p_entry_id !~ '^api_credit_[a-f0-9]{32}$' or p_received_at is null then raise exception 'Invalid API-credit reversal event.' using errcode='22023'; end if;
  select * into v_checkout from public.api_credit_checkouts where stripe_payment_intent_id=p_payment_intent_id for update;
  if not found then return jsonb_build_object('result','retry'); end if;
  insert into public.api_credit_stripe_events (stripe_event_id,event_type,object_id,payload_hash,processing_result,processed_at)
  values (p_event_id,p_event_type,p_reversal_id,p_payload_hash,'processed',p_received_at) on conflict (stripe_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return jsonb_build_object('result','duplicate','credits',0,'apiKeyId',v_checkout.api_key_id); end if;
  if v_checkout.status not in ('paid','reversed') or v_checkout.stripe_payment_currency<>lower(p_currency) or p_amount>v_checkout.stripe_payment_amount then
    update public.api_credit_stripe_events set processing_result='ignored' where stripe_event_id=p_event_id; return jsonb_build_object('result','ignored'); end if;
  insert into public.api_credit_payment_reversals (stripe_reversal_id,checkout_id,amount,currency,stripe_event_id,created_at)
    values (p_reversal_id,v_checkout.public_id,p_amount,lower(p_currency),p_event_id,p_received_at) on conflict (stripe_reversal_id) do nothing;
  select coalesce(sum(amount),0) into v_total_reversed from public.api_credit_payment_reversals where checkout_id=v_checkout.public_id;
  select coalesce(sum(-quantity),0) into v_new_total from public.api_credit_ledger_entries where checkout_id=v_checkout.public_id and entry_type='payment_reversal';
  v_quantity := greatest(0, least(v_checkout.credit_quantity, floor(v_checkout.credit_quantity::numeric * v_total_reversed / v_checkout.stripe_payment_amount))-v_new_total);
  if v_quantity>0 then insert into public.api_credit_ledger_entries (public_id,checkout_id,entry_type,quantity,stripe_event_id,stripe_reversal_id,metadata,created_at)
    values (p_entry_id,v_checkout.public_id,'payment_reversal',-v_quantity,p_event_id,p_reversal_id,jsonb_build_object('amount',p_amount,'currency',lower(p_currency)),p_received_at); end if;
  if v_total_reversed>=v_checkout.stripe_payment_amount then update public.api_credit_checkouts set status='reversed',reversed_at=p_received_at where public_id=v_checkout.public_id; end if;
  return jsonb_build_object('result','processed','credits',v_quantity,'apiKeyId',v_checkout.api_key_id);
end; $$;

revoke all on function public.process_api_credit_checkout_event(text,text,text,text,text,text,integer,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.process_api_credit_reversal_event(text,text,text,text,text,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.process_api_credit_checkout_event(text,text,text,text,text,text,integer,text,text,text,timestamptz) to service_role;
grant execute on function public.process_api_credit_reversal_event(text,text,text,text,text,integer,text,text,timestamptz) to service_role;
