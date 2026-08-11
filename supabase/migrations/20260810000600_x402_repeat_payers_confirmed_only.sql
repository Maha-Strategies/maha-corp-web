-- Repeat-buyer analytics counted from confirmed settlements, not from claims.
--
-- The previous version counted rows in x402_payments. That table records every
-- payment *claimed* -- it is the local replay guard, written before settlement
-- returns -- so a claim that then failed to settle, or that the chain
-- contradicted, counted as a purchase. The number that would have driven a
-- subscription decision was therefore an upper bound presented as a fact, and
-- it was wrong in the direction that flatters: every failure inflated it.
--
-- x402_settlements is the authoritative record of money that actually moved,
-- and its chain_status says whether reading the chain corroborated the
-- facilitator. Only 'confirmed' counts as a purchase here.
--
-- Unconfirmed settlements are reported alongside rather than folded in or
-- silently dropped. A deployment with no chain RPC writes chain_status null, so
-- collapsing "not confirmed" into "did not happen" would report zero revenue
-- for a working system -- and collapsing it into "confirmed" would restate the
-- original bug. Two numbers, each meaning one thing.

drop function if exists public.x402_repeat_payers(date, date);

create or replace function public.x402_repeat_payers(
  p_from_day date,
  p_to_day date
) returns table (
  payer text,
  resource text,
  -- Settlements the chain corroborated. The only number that may be called a
  -- purchase.
  confirmed_payment_count bigint,
  -- Claimed and settled, but not corroborated: chain_status null (no RPC
  -- configured) or 'indeterminate' (the node could not answer).
  unconfirmed_payment_count bigint,
  -- Claimed but never settled, or contradicted by the chain. Never a purchase.
  failed_payment_count bigint,
  first_confirmed_at timestamptz,
  last_confirmed_at timestamptz
) language sql security definer set search_path = public, extensions as $$
  select
    p.payer,
    p.resource,
    count(*) filter (where s.chain_status = 'confirmed') as confirmed_payment_count,
    count(*) filter (where s.transaction_id is not null and s.chain_status is distinct from 'confirmed'
                       and s.chain_status is distinct from 'contradicted') as unconfirmed_payment_count,
    count(*) filter (where s.transaction_id is null or s.chain_status = 'contradicted') as failed_payment_count,
    min(s.settled_at) filter (where s.chain_status = 'confirmed') as first_confirmed_at,
    max(s.settled_at) filter (where s.chain_status = 'confirmed') as last_confirmed_at
  from public.x402_payments p
  -- LEFT, deliberately. An inner join would make a claim that never settled
  -- vanish from the report entirely, and "no row" is indistinguishable from
  -- "no traffic" -- which is how a failing payment path stays invisible.
  left join public.x402_settlements s on s.transaction_id = p.transaction_id
  where p.claimed_at >= p_from_day::timestamptz
    and p.claimed_at < (p_to_day + 1)::timestamptz
  group by p.payer, p.resource;
$$;

revoke all on function public.x402_repeat_payers(date, date) from public, anon, authenticated;
grant execute on function public.x402_repeat_payers(date, date) to service_role;

comment on function public.x402_repeat_payers(date, date) is
  'Repeat autonomous purchase counts by payer address and resource, counted from confirmed settlements in x402_settlements rather than from claims in x402_payments. Unconfirmed and failed attempts are reported separately and are never counted as purchases. The payer address is the only durable identity an account-free buyer has; agent_task_spend_daily is keyed by tenant and task and cannot identify these wallets.';
