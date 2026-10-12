-- Metadata-only HTTP purchase recovery. Never apply to production as part of a test.
-- The 30-day window limits self-service access, NOT physical record retention.
-- No automatic deletion; financial-record/backup retention requires prelaunch review.
create table public.x402_micro_purchases (
  offer_id text not null,
  payer text not null check (payer ~ '^0x[a-f0-9]{40}$'),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{32}$'),
  secret_hash text not null check (secret_hash ~ '^sha256:[a-f0-9]{64}$'),
  response_digest text not null check (response_digest ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (offer_id,payer,idempotency_key),
  foreign key (offer_id,payer,idempotency_key) references public.x402_offer_admissions(offer_id,payer,idempotency_key)
);
alter table public.x402_micro_purchases enable row level security;
revoke all on public.x402_micro_purchases from public, anon, authenticated, service_role;
grant select on public.x402_micro_purchases to service_role;
comment on table public.x402_micro_purchases is
  'Immutable purchase bindings only; no bodies, raw secrets or payment signatures. Service-role-only. Thirty-day replay window; metadata has no automatic deletion. Hashes are not encryption or anonymization.';

create function public.reserve_x402_micro_purchase(
  p_offer_id text,p_payer text,p_idempotency_key text,p_input_hash text,
  p_resource text,p_amount numeric,p_secret_hash text,p_response_digest text
) returns table(decision text,payment_transaction text)
language plpgsql security definer set search_path = public,pg_catalog as $$
declare
  d record;
  m public.x402_micro_purchases%rowtype;
begin
  if p_idempotency_key !~ '^[a-f0-9]{32}$' or p_secret_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_response_digest !~ '^sha256:[a-f0-9]{64}$' then raise exception 'Invalid purchase binding'; end if;
  -- Serialize on the original admission key, then bind the prepared result in
  -- the SAME transaction. A lost response cannot leave a paid but unbound order.
  select * into d from public.reserve_x402_admission(p_offer_id,p_payer,p_idempotency_key,p_input_hash,p_resource,p_amount);
  if d.decision='conflict' then return query select 'conflict'::text,null::text; return; end if;
  select * into m from public.x402_micro_purchases
    where offer_id=p_offer_id and payer=p_payer and idempotency_key=p_idempotency_key;
  if found then
    if m.secret_hash is distinct from p_secret_hash or m.response_digest is distinct from p_response_digest
      or m.created_at <= now()-interval '30 days' then
      return query select 'conflict'::text,null::text; return;
    end if;
  elsif d.decision='proceed' then
    insert into public.x402_micro_purchases(offer_id,payer,idempotency_key,secret_hash,response_digest)
      values(p_offer_id,p_payer,p_idempotency_key,p_secret_hash,p_response_digest);
  else
    -- Do not retroactively turn legacy purchases into recoverable orders.
    return query select 'unavailable'::text,null::text; return;
  end if;
  return query select d.decision::text,d.payment_transaction::text;
end;
$$;

create function public.read_x402_micro_purchase(
  p_offer_id text,p_payer text,p_idempotency_key text,p_input_hash text,p_secret_hash text
) returns table(state text,response_digest text,transaction text,network text,amount numeric)
language sql stable security definer set search_path = public,pg_catalog as $$
  select case
    when m.created_at <= now()-interval '30 days' then 'expired'
    when r.state='contradicted' then 'contradicted'
    when r.state in ('settled','marker_failed') and r.transaction is not null then 'paid'
    when r.state='not_settled' then 'not_settled'
    when r.state='unknown' then 'unknown'
    else 'pending' end,
    m.response_digest,r.transaction,r.network,a.amount
  from public.x402_micro_purchases m
  join public.x402_offer_admissions a using(offer_id,payer,idempotency_key)
  left join public.x402_admission_recovery r using(offer_id,payer,idempotency_key)
  where m.offer_id=p_offer_id and m.payer=p_payer and m.idempotency_key=p_idempotency_key
    and m.secret_hash=p_secret_hash and a.input_hash=p_input_hash;
$$;
revoke all on function public.reserve_x402_micro_purchase(text,text,text,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.reserve_x402_micro_purchase(text,text,text,text,text,numeric,text,text) to service_role;
revoke all on function public.read_x402_micro_purchase(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.read_x402_micro_purchase(text,text,text,text,text) to service_role;
