-- Local release prerequisite. Never apply to production as part of a test.
-- Retains only purchase identifiers/hashes and outcomes, not signed payloads.
create table public.x402_admission_recovery (
  offer_id text not null,
  payer text not null,
  idempotency_key text not null,
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  resource text not null,
  amount numeric(38,0) not null check (amount > 0),
  payment_id text not null check (payment_id ~ '^[a-f0-9]{64}$'),
  network text not null check (length(network) between 1 and 100),
  state text not null check (state in ('pending','unknown','not_settled','settled','contradicted','marker_failed')),
  transaction text check (transaction is null or length(transaction) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (offer_id, payer, idempotency_key),
  foreign key (offer_id, payer, idempotency_key)
    references public.x402_offer_admissions (offer_id, payer, idempotency_key),
  check (state not in ('settled','contradicted','marker_failed') or transaction is not null)
);
alter table public.x402_admission_recovery enable row level security;
revoke all on public.x402_admission_recovery from public, anon, authenticated;
grant select, insert, update on public.x402_admission_recovery to service_role;
create index x402_admission_recovery_unresolved_idx
  on public.x402_admission_recovery(updated_at)
  where state in ('pending','unknown','contradicted','marker_failed');

create function public.record_x402_admission_recovery(
  p_offer_id text, p_payer text, p_idempotency_key text,
  p_input_hash text, p_resource text, p_amount numeric,
  p_payment_id text, p_network text, p_state text, p_transaction text default null
) returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  a public.x402_offer_admissions%rowtype;
  r public.x402_admission_recovery%rowtype;
begin
  select * into a from public.x402_offer_admissions
    where offer_id=p_offer_id and payer=p_payer and idempotency_key=p_idempotency_key for update;
  if not found or a.input_hash is distinct from p_input_hash
    or a.resource is distinct from p_resource or a.amount is distinct from p_amount then
    raise exception 'Recovery purchase binding mismatch';
  end if;
  select * into r from public.x402_admission_recovery
    where offer_id=p_offer_id and payer=p_payer and idempotency_key=p_idempotency_key for update;
  if found then
    -- A pending replacement is allowed only after explicit non-settlement.
    if p_state='pending' and (r.state<>'not_settled' or a.state<>'reserved') then
      raise exception 'An unresolved authorization cannot be replaced';
    end if;
    if p_state<>'pending' and (r.payment_id is distinct from p_payment_id or r.network is distinct from p_network) then
      raise exception 'Recovery authorization binding mismatch';
    end if;
    if r.transaction is not null and r.transaction is distinct from p_transaction then
      raise exception 'Recorded transaction cannot be replaced';
    end if;
    if r.state='contradicted' and p_state<>'contradicted' then
      raise exception 'Contradiction requires independent operator reconciliation';
    end if;
    if r.state in ('settled','marker_failed') and p_state not in ('settled','marker_failed','contradicted') then
      raise exception 'Known settlement cannot become unpaid';
    end if;
  elsif p_state<>'pending' or a.state<>'reserved' then
    raise exception 'Recovery must be recorded before settlement';
  end if;
  insert into public.x402_admission_recovery
    (offer_id,payer,idempotency_key,input_hash,resource,amount,payment_id,network,state,transaction)
  values (p_offer_id,p_payer,p_idempotency_key,p_input_hash,p_resource,p_amount,p_payment_id,p_network,p_state,p_transaction)
  on conflict (offer_id,payer,idempotency_key) do update set
    payment_id=excluded.payment_id, network=excluded.network, state=excluded.state,
    transaction=excluded.transaction, updated_at=now();
end;
$$;

create function public.read_x402_admission_recovery(
  p_offer_id text, p_payer text, p_idempotency_key text,
  p_input_hash text, p_resource text, p_amount numeric
) returns table (state text, transaction text, payment_id text, network text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select r.state,r.transaction,r.payment_id,r.network from public.x402_admission_recovery r
  where r.offer_id=p_offer_id and r.payer=p_payer and r.idempotency_key=p_idempotency_key
    and r.input_hash=p_input_hash and r.resource=p_resource and r.amount=p_amount;
$$;
revoke all on function public.record_x402_admission_recovery(text,text,text,text,text,numeric,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_x402_admission_recovery(text,text,text,text,text,numeric,text,text,text,text) to service_role;
revoke all on function public.read_x402_admission_recovery(text,text,text,text,text,numeric) from public, anon, authenticated;
grant execute on function public.read_x402_admission_recovery(text,text,text,text,text,numeric) to service_role;

-- Read-only aggregate for the existing readiness monitor. No automatic unlock.
create function public.x402_admission_recovery_health()
returns table (state text, count bigint)
language sql stable security definer set search_path = public, pg_catalog as $$
  select s.state, count(r.offer_id) from
    (values ('unknown'),('contradicted'),('marker_failed'),('stale_pending')) s(state)
  left join public.x402_admission_recovery r on
    (r.state=s.state or (s.state='stale_pending' and r.state='pending' and r.updated_at < now()-interval '5 minutes'))
  group by s.state
  union all
  select 'legacy_reserved',count(*) from public.x402_offer_admissions a
  left join public.x402_admission_recovery r using (offer_id,payer,idempotency_key)
  where a.state='reserved' and r.offer_id is null and a.created_at < now()-interval '5 minutes';
$$;
revoke all on function public.x402_admission_recovery_health() from public, anon, authenticated;
grant execute on function public.x402_admission_recovery_health() to service_role;
