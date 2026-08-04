-- Records what reading the chain established about a settlement.
--
-- Until now "settled" meant the facilitator said so over HTTPS. That is a
-- trust relationship, not a verification, and it was described as an
-- independent check in material prepared for outside review. This makes the
-- distinction a stored fact: every settlement row now says whether a node was
-- consulted and what it found.
--
-- `indeterminate` is a first-class outcome, not an error. Confirmation happens
-- after the payer's money has already moved, so an unreachable node must not
-- withhold a resource that was paid for. The settlement is served and recorded
-- as unconfirmed, which is exactly the population a reconciliation sweep
-- should read:
--
--   select * from public.x402_settlements where chain_status <> 'confirmed';
--
-- Additive only. The columns are nullable so rows written before this migration
-- remain valid and are visibly distinguishable from rows written after.

alter table public.x402_settlements
  add column if not exists chain_status text
    check (chain_status is null or chain_status in ('confirmed', 'contradicted', 'indeterminate')),
  add column if not exists chain_block_number numeric(78, 0)
    check (chain_block_number is null or chain_block_number >= 0),
  -- The amount the chain says moved, which is not necessarily the amount the
  -- facilitator reported. Keeping both is the point.
  add column if not exists chain_amount numeric(38, 0)
    check (chain_amount is null or chain_amount >= 0),
  add column if not exists chain_detail text
    check (chain_detail is null or length(chain_detail) between 1 and 200);

create index if not exists x402_settlements_unconfirmed_idx
  on public.x402_settlements (settled_at desc)
  where chain_status is distinct from 'confirmed';

-- Replaces the three-argument form. The old signature is dropped rather than
-- left callable, so a deployment cannot keep writing settlements with no
-- confirmation column silently populated.
drop function if exists public.record_x402_settlement(text, text, text);

create or replace function public.record_x402_settlement(
  p_payment_id text,
  p_transaction_id text,
  p_network text,
  p_chain_status text default null,
  p_chain_block_number numeric default null,
  p_chain_amount numeric default null,
  p_chain_detail text default null
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inserted integer;
begin
  if p_payment_id !~ '^[0-9a-f]{64}$'
    or coalesce(length(p_transaction_id), 0) = 0
    or coalesce(length(p_network), 0) = 0
  then raise exception 'Invalid x402 settlement record.' using errcode = '22023'; end if;

  if p_chain_status is not null and p_chain_status not in ('confirmed', 'contradicted', 'indeterminate') then
    raise exception 'Invalid chain status.' using errcode = '22023';
  end if;

  insert into public.x402_settlements
    (payment_id, transaction_id, network, chain_status, chain_block_number, chain_amount, chain_detail)
  values
    (p_payment_id, p_transaction_id, p_network, p_chain_status, p_chain_block_number, p_chain_amount,
     left(p_chain_detail, 200))
  on conflict (payment_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 'duplicate'; end if;
  return 'recorded';
end;
$$;

revoke all on function public.record_x402_settlement(text, text, text, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.record_x402_settlement(text, text, text, text, numeric, numeric, text) to service_role;

comment on column public.x402_settlements.chain_status is
  'What an independent node read established: confirmed, contradicted, or indeterminate. Null for rows written before chain confirmation existed. Anything other than confirmed is a reconciliation candidate, not necessarily a fault -- confirmation runs after the payer''s funds have moved, so an unreachable node records rather than refuses.';

comment on column public.x402_settlements.chain_amount is
  'The amount the chain says moved, recorded alongside the facilitator''s account of the transaction rather than in place of it.';
