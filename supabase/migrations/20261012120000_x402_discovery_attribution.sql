-- Apply before deploying new source labels. No historical labels are rewritten.
begin;
alter table public.x402_offer_usage_daily drop constraint x402_offer_usage_daily_discovery_source_check;
alter table public.x402_offer_usage_daily add constraint x402_offer_usage_daily_discovery_source_check
  check (discovery_source in ('bazaar','maha_canary','direct','reddit','alsp','nohumans','tanod','nsgoods','unknown'));

create or replace function public.record_x402_offer_usage(
  p_offer_id text, p_event_kind text, p_status_class text, p_discovery_source text default 'unknown',
  p_input_tokens numeric default 0, p_output_tokens numeric default 0, p_tokens_saved numeric default 0,
  p_required_evidence numeric default 0, p_retained_evidence numeric default 0, p_observed_at timestamptz default now()
) returns void language plpgsql security definer set search_path=public,extensions as $$
declare
  v_at timestamptz:=coalesce(p_observed_at,now());
  v_source text:=case when p_discovery_source in ('bazaar','maha_canary','direct','reddit','alsp','nohumans','tanod','nsgoods') then p_discovery_source else 'unknown' end;
begin
  if p_offer_id is null or p_offer_id !~ '^[a-z0-9-]{1,80}$' or p_event_kind is null or p_event_kind not in ('challenge','invocation')
    or p_status_class is null or p_status_class not in ('2xx','4xx','5xx') then raise exception 'Invalid aggregate event.' using errcode='22023'; end if;
  insert into public.x402_offer_usage_daily as t
    (usage_day,offer_id,event_kind,status_class,discovery_source,event_count,input_tokens_estimated,output_tokens_estimated,tokens_saved_estimated,
     required_evidence_total,retained_evidence_total,first_observed_at,last_observed_at)
  values ((v_at at time zone 'utc')::date,p_offer_id,p_event_kind,p_status_class,v_source,1,
    greatest(coalesce(p_input_tokens,0),0),greatest(coalesce(p_output_tokens,0),0),greatest(coalesce(p_tokens_saved,0),0),
    greatest(coalesce(p_required_evidence,0),0),greatest(coalesce(p_retained_evidence,0),0),v_at,v_at)
  on conflict (usage_day,offer_id,event_kind,status_class,discovery_source) do update set
    event_count=t.event_count+1,input_tokens_estimated=t.input_tokens_estimated+excluded.input_tokens_estimated,
    output_tokens_estimated=t.output_tokens_estimated+excluded.output_tokens_estimated,tokens_saved_estimated=t.tokens_saved_estimated+excluded.tokens_saved_estimated,
    required_evidence_total=t.required_evidence_total+excluded.required_evidence_total,retained_evidence_total=t.retained_evidence_total+excluded.retained_evidence_total,
    first_observed_at=least(t.first_observed_at,v_at),last_observed_at=greatest(t.last_observed_at,v_at);
end; $$;
revoke all on function public.record_x402_offer_usage(text,text,text,text,numeric,numeric,numeric,numeric,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.record_x402_offer_usage(text,text,text,text,numeric,numeric,numeric,numeric,numeric,timestamptz) to service_role;

-- Private, unique-authorization grain. A prepared server response is NOT buyer receipt.
create table public.x402_purchase_attributions (
  network text not null check (network in ('eip155:8453','eip155:42161')),
  payment_id text not null check (payment_id ~ '^[a-f0-9]{64}$'),
  offer_id text not null check (offer_id ~ '^[a-z0-9-]{1,80}$'),
  payer_key text not null check (payer_key ~ '^[a-f0-9]{64}$'),
  amount_base_units numeric(18,0) not null check (amount_base_units>0),
  transaction_hash text check (transaction_hash ~ '^0x[a-f0-9]{64}$'),
  discovery_source text not null check (discovery_source in ('bazaar','maha_canary','direct','reddit','alsp','nohumans','tanod','nsgoods','unknown')),
  source_evidence text not null default 'self_reported' check (source_evidence='self_reported'),
  settlement_state text not null check (settlement_state in ('unknown','confirmed')),
  response_prepared boolean not null default false,
  response_attempts bigint not null default 0 check (response_attempts>=0),
  recovery_attempts bigint not null default 0 check (recovery_attempts>=0),
  operator_activity boolean not null,
  first_observed_at timestamptz not null default now(), last_observed_at timestamptz not null default now(),
  primary key(network,payment_id),
  check (settlement_state<>'confirmed' or transaction_hash is not null)
);
create index x402_purchase_attributions_offer_payer on public.x402_purchase_attributions(offer_id,payer_key);
create index x402_purchase_attributions_retention on public.x402_purchase_attributions(first_observed_at);
alter table public.x402_purchase_attributions enable row level security;
revoke all on table public.x402_purchase_attributions from public,anon,authenticated,service_role;
grant select on table public.x402_purchase_attributions to service_role;

create function public.record_x402_purchase_attribution(
  p_offer_id text,p_payment_id text,p_network text,p_payer_key text,p_amount numeric,p_transaction text,
  p_source text,p_settlement text,p_response_prepared boolean,p_replayed boolean,p_operator boolean
) returns void language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.x402_purchase_attributions%rowtype; v_inserted integer;
begin
  if p_settlement is null or p_settlement not in ('unknown','confirmed') or p_response_prepared is null
    or p_replayed is null or p_operator is null or (p_settlement='unknown' and (p_transaction is not null or p_response_prepared))
    then raise exception 'Invalid purchase observation.' using errcode='22023'; end if;
  insert into public.x402_purchase_attributions(network,payment_id,offer_id,payer_key,amount_base_units,transaction_hash,discovery_source,
    settlement_state,response_prepared,response_attempts,recovery_attempts,operator_activity)
  values(p_network,p_payment_id,p_offer_id,p_payer_key,p_amount,p_transaction,
    case when p_source in ('bazaar','maha_canary','direct','reddit','alsp','nohumans','tanod','nsgoods') then p_source else 'unknown' end,
    p_settlement,p_response_prepared,case when p_response_prepared then 1 else 0 end,case when p_replayed then 1 else 0 end,p_operator)
  on conflict(network,payment_id) do nothing;
  get diagnostics v_inserted=row_count;
  select * into v_row from public.x402_purchase_attributions where network=p_network and payment_id=p_payment_id for update;
  if not found then raise exception 'Purchase missing.'; end if;
  if v_row.offer_id is distinct from p_offer_id or v_row.payer_key is distinct from p_payer_key or v_row.amount_base_units is distinct from p_amount
    or v_row.operator_activity is distinct from p_operator or (v_row.transaction_hash is not null and p_transaction is not null and v_row.transaction_hash<>p_transaction)
    then raise exception 'Purchase identity conflict.' using errcode='22023'; end if;
  -- First insert already recorded this response attempt; only existing rows increment.
  update public.x402_purchase_attributions set
    transaction_hash=coalesce(v_row.transaction_hash,p_transaction),
    settlement_state=case when v_row.settlement_state='confirmed' or p_settlement='confirmed' then 'confirmed' else 'unknown' end,
    response_prepared=v_row.response_prepared or p_response_prepared,
    response_attempts=v_row.response_attempts+case when v_inserted=0 and p_response_prepared then 1 else 0 end,
    recovery_attempts=v_row.recovery_attempts+case when v_inserted=0 and p_replayed then 1 else 0 end,
    last_observed_at=greatest(v_row.last_observed_at,now())
  where network=p_network and payment_id=p_payment_id;
end; $$;
revoke all on function public.record_x402_purchase_attribution(text,text,text,text,numeric,text,text,text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.record_x402_purchase_attribution(text,text,text,text,numeric,text,text,text,boolean,boolean,boolean) to service_role;
comment on table public.x402_purchase_attributions is 'Private receipt-linked, self-reported discovery attribution. Wallet keys are pseudonyms, not anonymous identities. Responses prepared are not proof of buyer receipt. No source text or signing evidence.';

-- Only the NEW attribution table is eligible. No payment, settlement, replay,
-- recovery, aggregate usage or financial ledger is deleted by this function.
-- Cutoff is server-controlled and fixed to first observation, never last retry.
create function public.prune_x402_purchase_attributions()
returns jsonb language plpgsql security definer set search_path=public,extensions set statement_timeout='5s' as $$
declare v_deleted integer; v_pending boolean;
begin
  with expired as (
    select network,payment_id from public.x402_purchase_attributions
    where first_observed_at < now()-interval '90 days'
    order by first_observed_at,network,payment_id limit 1000 for update skip locked
  )
  delete from public.x402_purchase_attributions t using expired e
    where t.network=e.network and t.payment_id=e.payment_id;
  get diagnostics v_deleted=row_count;
  select exists(select 1 from public.x402_purchase_attributions
    where first_observed_at < now()-interval '90 days') into v_pending;
  return jsonb_build_object('deleted',v_deleted,'expiredRemaining',v_pending,'retentionDays',90);
end; $$;
revoke all on function public.prune_x402_purchase_attributions() from public,anon,authenticated;
grant execute on function public.prune_x402_purchase_attributions() to service_role;
notify pgrst,'reload schema';
commit;
