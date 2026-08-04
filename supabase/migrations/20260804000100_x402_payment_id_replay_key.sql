-- migration-allow-destructive: rekeys x402_payments from a settlement hash to a
-- payload hash. The old key cannot exist at claim time, so the previous shape
-- refused every payment and the table is necessarily empty; the guard below
-- aborts the migration rather than dropping a table that turns out to hold rows.

-- Corrects the replay key.
--
-- 20260803000500 keyed this table on the facilitator's settlement transaction
-- hash. That identifier does not exist when the claim has to be made. The x402
-- `verify` operation returns only `{ isValid, payer }`; a transaction hash
-- appears solely in the `settle` response, and the claim must precede
-- settlement or two concurrent presentations of one payment both settle. The
-- practical effect of the old shape was that every payment was refused.
--
-- The correct key is a SHA-256 of the canonically-serialized signed payload.
-- It exists before verification, it is what the payer actually signed, and two
-- presentations of one authorization share it whether or not either settles --
-- which is precisely the replay this table exists to stop.
--
-- Settlement moves to its own append-only table. Writing the transaction hash
-- back onto the claim row would require UPDATE, which is revoked on every
-- commercial ledger here by design. A claim with no matching settlement row is
-- a meaningful state -- paid and admitted, chain result unrecorded -- and is
-- what a reconciliation sweep should look for.

do $$
begin
  if to_regclass('public.x402_payments') is not null then
    if exists (select 1 from public.x402_payments) then
      raise exception 'x402_payments is not empty; rekeying it would discard commercial records. Migrate the rows deliberately.'
        using errcode = '55000';
    end if;
    drop table public.x402_payments;
  end if;
end $$;

drop function if exists public.claim_x402_payment(text, text, text, text, numeric, text);

create table if not exists public.x402_payments (
  -- SHA-256, lowercase hex, of the canonical signed payment payload.
  payment_id text primary key check (payment_id ~ '^[0-9a-f]{64}$'),
  -- CAIP-2 network identifier, e.g. eip155:8453 for Base.
  network text not null check (length(network) between 1 and 64),
  -- The exact resource paid for. Recorded so a challenge issued for one
  -- endpoint cannot later be argued to have covered another.
  resource text not null check (length(resource) between 1 and 500),
  -- Payer address and amount are retained deliberately. Unlike telemetry,
  -- these are the commercial record of a transaction, and an account-free
  -- payment has no other trace of who paid what. The amount is the price the
  -- facilitator validated the signed payload against, not a figure the caller
  -- supplied.
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

create table if not exists public.x402_settlements (
  payment_id text primary key references public.x402_payments (payment_id),
  -- The facilitator's on-chain transaction identifier.
  transaction_id text not null check (length(transaction_id) between 1 and 200),
  network text not null check (length(network) between 1 and 64),
  settled_at timestamptz not null default now()
);

create index if not exists x402_settlements_settled_at_idx
  on public.x402_settlements (settled_at desc);

alter table public.x402_settlements enable row level security;
revoke all on table public.x402_settlements from public, anon, authenticated;
grant select, insert on table public.x402_settlements to service_role;
revoke update, delete, truncate on table public.x402_settlements from service_role;

-- Returns 'claimed' the first time a payload is presented and 'duplicate' on
-- every presentation after. The caller serves the resource only on 'claimed'.
create or replace function public.claim_x402_payment(
  p_payment_id text,
  p_network text,
  p_resource text,
  p_payer text,
  p_amount_paid numeric,
  p_asset text
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inserted integer;
begin
  if p_payment_id !~ '^[0-9a-f]{64}$'
    or coalesce(length(p_network), 0) = 0
    or coalesce(length(p_resource), 0) = 0
    or coalesce(length(p_payer), 0) = 0
    or coalesce(length(p_asset), 0) = 0
    or p_amount_paid is null or p_amount_paid <= 0
  then raise exception 'Invalid x402 payment claim.' using errcode = '22023'; end if;

  insert into public.x402_payments
    (payment_id, network, resource, payer, amount_paid, asset)
  values
    (p_payment_id, p_network, p_resource, p_payer, p_amount_paid, p_asset)
  on conflict (payment_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  return 'claimed';
end;
$$;

revoke all on function public.claim_x402_payment(text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.claim_x402_payment(text, text, text, text, numeric, text) to service_role;

-- Records the chain result for an already-claimed payment. Never gates access:
-- the claim decided that, and this runs after settlement has happened.
-- A repeat call is a no-op rather than an error, because a retried settlement
-- record must not surface as a failure on a request that was already served.
create or replace function public.record_x402_settlement(
  p_payment_id text,
  p_transaction_id text,
  p_network text
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inserted integer;
begin
  if p_payment_id !~ '^[0-9a-f]{64}$'
    or coalesce(length(p_transaction_id), 0) = 0
    or coalesce(length(p_network), 0) = 0
  then raise exception 'Invalid x402 settlement record.' using errcode = '22023'; end if;

  insert into public.x402_settlements (payment_id, transaction_id, network)
  values (p_payment_id, p_transaction_id, p_network)
  on conflict (payment_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  return 'recorded';
end;
$$;

revoke all on function public.record_x402_settlement(text, text, text) from public, anon, authenticated;
grant execute on function public.record_x402_settlement(text, text, text) to service_role;

comment on table public.x402_payments is
  'Append-only claim ledger for machine payments over HTTP 402, keyed on a SHA-256 of the signed payment payload. Guards against a valid payment authorization being replayed against this API; chain-level replay is the facilitator''s concern. Payer and amount are retained as the commercial record of an otherwise account-free transaction.';

comment on table public.x402_settlements is
  'Append-only chain result for a claimed x402 payment. Separate from x402_payments because the transaction hash only exists after settlement and UPDATE is revoked on these ledgers. A claim with no settlement row means the resource was served but the chain result was not recorded.';
