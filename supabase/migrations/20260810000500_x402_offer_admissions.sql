-- Idempotency for paid offers, claimed *before* a payment settles.
--
-- The bug this fixes: the proxy settles a payment and only then does the route
-- look up (payer, client_request_id). A payer that retries a timed-out request
-- with a freshly signed authorization therefore pays a second time, and the
-- route cheerfully answers `idempotentReplay: true` -- reporting that no second
-- charge occurred while a second charge sits in the ledger. Route-level
-- deduplication cannot fix that, because by the time the route runs the money
-- has moved. The claim has to happen earlier than the settlement it is meant to
-- prevent.
--
-- x402's own replay guard does not cover this. It stops one *authorization*
-- being spent twice; this stops two authorizations being spent on one logical
-- request. Different failures, different tables.
--
-- The reservation binds everything that makes a request that request: the
-- offer, the payer, their idempotency key, the input hash, the resource, and
-- the price. A key reused with different terms is a conflict rather than a
-- cheaper second job.

create table if not exists public.x402_offer_admissions (
  offer_id text not null check (char_length(offer_id) between 1 and 80),
  -- The payer address, from facilitator verification, which happens before
  -- settlement. Not caller-supplied: a caller could otherwise claim someone
  -- else's key and read back their job.
  payer text not null check (length(payer) between 1 and 200),
  -- The caller's own idempotency key, echoing its clientRequestId.
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),

  -- Declared by the caller before settlement and enforced by the route after:
  -- the job is created for this hash, and a body that does not hash to it is
  -- refused. Binding on the declared value is what lets the conflict be
  -- detected before any money moves.
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  resource text not null check (length(resource) between 1 and 500),
  amount numeric(38, 0) not null check (amount > 0),

  -- reserved: claimed, not yet settled. settled: paid, transaction recorded.
  -- failed: settlement did not complete, so the key is free to try again.
  state text not null check (state in ('reserved', 'settled', 'failed')),
  payment_transaction text check (payment_transaction is null or length(payment_transaction) between 1 and 200),

  created_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key (offer_id, payer, idempotency_key)
);

create index if not exists x402_offer_admissions_created_idx
  on public.x402_offer_admissions (created_at desc);

-- Stale reservations: claimed but never settled, e.g. the process died between
-- the claim and the facilitator's answer.
create index if not exists x402_offer_admissions_reserved_idx
  on public.x402_offer_admissions (created_at)
  where state = 'reserved';

alter table public.x402_offer_admissions enable row level security;
revoke all on table public.x402_offer_admissions from public, anon, authenticated;
grant select, insert, update on table public.x402_offer_admissions to service_role;
revoke delete, truncate on table public.x402_offer_admissions from service_role;

-- Claims the right to settle, or explains why not.
--
-- Returns one row: (decision, payment_transaction). Decisions:
--   proceed      -- the caller now holds the claim and may settle.
--   already_paid -- this logical request settled before; reuse that transaction
--                   and do not settle again.
--   in_progress  -- another request holds the claim and has not finished.
--   conflict     -- the key was used with different input, resource or price.
--
-- The whole point is that this is one statement. A read followed by a write
-- would let two concurrent duplicates both observe "no reservation" and both
-- settle, which is the exact race the table exists to close.
create or replace function public.reserve_x402_admission(
  p_offer_id text,
  p_payer text,
  p_idempotency_key text,
  p_input_hash text,
  p_resource text,
  p_amount numeric,
  -- Reservations older than this are treated as abandoned and retaken, so a
  -- process that died mid-settlement does not lock a payer out of their key
  -- forever.
  p_stale_after interval default interval '5 minutes'
) returns table (decision text, payment_transaction text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.x402_offer_admissions%rowtype;
begin
  insert into public.x402_offer_admissions
    (offer_id, payer, idempotency_key, input_hash, resource, amount, state)
  values
    (p_offer_id, p_payer, p_idempotency_key, p_input_hash, p_resource, p_amount, 'reserved')
  on conflict (offer_id, payer, idempotency_key) do nothing;

  if found then
    return query select 'proceed'::text, null::text;
    return;
  end if;

  -- Locked, so a concurrent caller evaluating the same row waits here rather
  -- than reading a state that is about to change under it.
  select * into v_existing
  from public.x402_offer_admissions
  where offer_id = p_offer_id and payer = p_payer and idempotency_key = p_idempotency_key
  for update;

  -- Same key, different request. Refused before anything settles.
  if v_existing.input_hash is distinct from p_input_hash
     or v_existing.resource is distinct from p_resource
     or v_existing.amount is distinct from p_amount then
    return query select 'conflict'::text, null::text;
    return;
  end if;

  if v_existing.state = 'settled' then
    return query select 'already_paid'::text, v_existing.payment_transaction;
    return;
  end if;

  if v_existing.state = 'reserved' and v_existing.created_at > now() - p_stale_after then
    return query select 'in_progress'::text, null::text;
    return;
  end if;

  -- Failed, or reserved and abandoned. Retake it.
  update public.x402_offer_admissions
    set state = 'reserved', created_at = now(), payment_transaction = null, settled_at = null
  where offer_id = p_offer_id and payer = p_payer and idempotency_key = p_idempotency_key;

  return query select 'proceed'::text, null::text;
end;
$$;

create or replace function public.settle_x402_admission(
  p_offer_id text,
  p_payer text,
  p_idempotency_key text,
  p_transaction text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.x402_offer_admissions
    set state = 'settled', payment_transaction = p_transaction, settled_at = now()
  where offer_id = p_offer_id and payer = p_payer and idempotency_key = p_idempotency_key
    and state <> 'settled';
end;
$$;

-- Releases a claim whose settlement did not complete, so the payer can try
-- again with the same key rather than being locked out of a job they never got.
create or replace function public.release_x402_admission(
  p_offer_id text,
  p_payer text,
  p_idempotency_key text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.x402_offer_admissions
    set state = 'failed'
  where offer_id = p_offer_id and payer = p_payer and idempotency_key = p_idempotency_key
    and state = 'reserved';
end;
$$;

revoke all on function public.reserve_x402_admission(text, text, text, text, text, numeric, interval) from public, anon, authenticated;
grant execute on function public.reserve_x402_admission(text, text, text, text, text, numeric, interval) to service_role;
revoke all on function public.settle_x402_admission(text, text, text, text) from public, anon, authenticated;
grant execute on function public.settle_x402_admission(text, text, text, text) to service_role;
revoke all on function public.release_x402_admission(text, text, text) from public, anon, authenticated;
grant execute on function public.release_x402_admission(text, text, text) to service_role;

comment on table public.x402_offer_admissions is
  'Pre-settlement idempotency claims for paid x402 offers. Distinct from x402_payments, which stops one authorization being spent twice; this stops two authorizations being spent on one logical request. Binds offer, payer, idempotency key, input hash, resource and price.';
