-- Records machine payments accepted over HTTP 402, so one payment buys one
-- resource.
--
-- The facilitator checks the nonce on-chain and will not settle the same
-- payment twice. That is not the risk this table addresses. The risk is local:
-- a valid payment proof is a bearer token, and an agent that replays it against
-- this API would be served the resource again for free unless the server
-- records that it has already been honoured. Chain-level and
-- application-level replay are different failures, and only the second one is
-- ours to prevent.
--
-- Mirrors stripe_webhook_events: the identifier is claimed under a unique
-- constraint in the same statement that records the payment, so two concurrent
-- presentations of one payment cannot both succeed.
--
-- Append-only, like every other commercial ledger here. service_role receives
-- insert and select and nothing else: a payment record must never be updated
-- or deleted, and the privilege audit of 20260803000200 is the reason that is
-- enforced rather than merely intended.

create table if not exists public.x402_payments (
  -- The facilitator's settled transaction identifier. Not generated here; a
  -- payment we did not verify has no business claiming an identifier.
  transaction_id text primary key check (length(transaction_id) between 1 and 200),
  -- CAIP-2 network identifier, e.g. eip155:8453 for Base.
  network text not null check (length(network) between 1 and 64),
  -- The exact resource paid for. Recorded so a challenge issued for one
  -- endpoint cannot later be argued to have covered another.
  resource text not null check (length(resource) between 1 and 500),
  -- Payer address and amount are retained deliberately. Unlike telemetry,
  -- these are the commercial record of a transaction, and an account-free
  -- payment has no other trace of who paid what.
  payer text not null check (length(payer) between 1 and 200),
  amount_paid numeric(38, 0) not null check (amount_paid > 0),
  asset text not null check (length(asset) between 1 and 200),
  claimed_at timestamptz not null default now()
);

create index if not exists x402_payments_claimed_at_idx
  on public.x402_payments (claimed_at desc);

create index if not exists x402_payments_resource_idx
  on public.x402_payments (resource, claimed_at desc);

alter table public.x402_payments enable row level security;
revoke all on table public.x402_payments from public, anon, authenticated;
grant select, insert on table public.x402_payments to service_role;
-- The revoke is not redundant with the grant above. Since 20260803000300
-- declared Supabase's role-level default privileges, every new table is
-- created already carrying DELETE and UPDATE for service_role, and granting
-- select and insert adds to that rather than replacing it. Verified: without
-- this line, service_role can rewrite a settled payment.
revoke update, delete, truncate on table public.x402_payments from service_role;

-- Returns 'claimed' the first time a transaction is presented and 'duplicate'
-- on every presentation after. The caller serves the resource only on
-- 'claimed'.
create or replace function public.claim_x402_payment(
  p_transaction_id text,
  p_network text,
  p_resource text,
  p_payer text,
  p_amount_paid numeric,
  p_asset text
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inserted integer;
begin
  if coalesce(length(p_transaction_id), 0) = 0
    or coalesce(length(p_network), 0) = 0
    or coalesce(length(p_resource), 0) = 0
    or coalesce(length(p_payer), 0) = 0
    or coalesce(length(p_asset), 0) = 0
    or p_amount_paid is null or p_amount_paid <= 0
  then raise exception 'Invalid x402 payment claim.' using errcode = '22023'; end if;

  insert into public.x402_payments
    (transaction_id, network, resource, payer, amount_paid, asset)
  values
    (p_transaction_id, p_network, p_resource, p_payer, p_amount_paid, p_asset)
  on conflict (transaction_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  return 'claimed';
end;
$$;

revoke all on function public.claim_x402_payment(text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.claim_x402_payment(text, text, text, text, numeric, text) to service_role;

comment on table public.x402_payments is
  'Append-only record of machine payments accepted over HTTP 402. Guards against a valid payment proof being replayed against this API; chain-level replay is the facilitator''s concern. Payer and amount are retained as the commercial record of an otherwise account-free transaction.';
