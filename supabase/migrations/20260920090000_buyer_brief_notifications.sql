-- Durable, private seller notifications. Never store recovery secrets or input bodies.
create table public.buyer_brief_notifications (
  id uuid primary key default gen_random_uuid(),
  payer text not null,
  order_id text not null,
  kind text not null check (kind in ('purchase_recorded','delivery_problem','correction_requested','refund_requested')),
  payment_transaction text not null,
  created_at timestamptz not null default now(),
  state text not null default 'pending' check (state in ('pending','sending','sent','manual_review')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text,
  sent_at timestamptz,
  unique(payer,order_id,kind)
);
alter table public.buyer_brief_notifications enable row level security;
revoke all on public.buyer_brief_notifications from public,anon,authenticated;
grant select,insert,update on public.buyer_brief_notifications to service_role;

create function public.notify_buyer_brief_settlement() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.offer_id='cabezon-buyer-brief-pack' and new.state='settled' and new.payment_transaction is not null then
    insert into public.buyer_brief_notifications(payer,order_id,kind,payment_transaction)
    values(lower(new.payer),new.idempotency_key,'purchase_recorded',new.payment_transaction)
    on conflict(payer,order_id,kind) do nothing;
  end if;
  return new;
end $$;
create trigger buyer_brief_settlement_notification after insert or update on public.x402_offer_admissions
for each row execute function public.notify_buyer_brief_settlement();
revoke all on function public.notify_buyer_brief_settlement() from public,anon,authenticated;

create function public.enqueue_buyer_brief_notification(p_payer text,p_order_id text,p_input_hash text,p_kind text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tx text; v_id uuid;
begin
  if p_kind not in ('delivery_problem','correction_requested','refund_requested') then raise exception 'invalid_kind'; end if;
  select payment_transaction into strict v_tx from public.x402_offer_admissions
    where offer_id='cabezon-buyer-brief-pack' and lower(payer)=lower(p_payer) and idempotency_key=p_order_id
    and input_hash=p_input_hash and state='settled' and amount=20000000
    and resource='https://www.mahastrategies.com/api/v1/cabezon/buyer-brief';
  if v_tx is null then raise exception 'unconfirmed_order'; end if;
  insert into public.buyer_brief_notifications(payer,order_id,kind,payment_transaction)
    values(lower(p_payer),p_order_id,p_kind,v_tx) on conflict(payer,order_id,kind) do nothing;
  select id into v_id from public.buyer_brief_notifications where payer=lower(p_payer) and order_id=p_order_id and kind=p_kind;
  return v_id;
end $$;

create function public.claim_buyer_brief_notifications() returns setof public.buyer_brief_notifications
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Provider idempotency expires after 24h. Do not resend an ambiguous event
  -- outside a conservative 22h window, or after ten failed attempts.
  update public.buyer_brief_notifications set state='manual_review',lease_id=null,lease_until=null
  where state in ('pending','sending') and (first_attempt_at < now()-interval '22 hours' or attempts>=10)
    and (lease_until is null or lease_until<now());
  return query with candidates as (
    select id from public.buyer_brief_notifications
    where ((state='pending' and next_attempt_at<=now()) or (state='sending' and lease_until<now()))
      and attempts<10 and (first_attempt_at is null or first_attempt_at>=now()-interval '22 hours')
    order by created_at for update skip locked limit 5
  ) update public.buyer_brief_notifications n set state='sending',attempts=n.attempts+1,
      first_attempt_at=coalesce(n.first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    from candidates c where n.id=c.id returning n.*;
end $$;

create function public.buyer_brief_notifications_ready() returns boolean
language sql security definer set search_path=public,pg_temp as $$
  select exists(select 1 from pg_trigger where tgname='buyer_brief_settlement_notification'
    and tgrelid='public.x402_offer_admissions'::regclass and tgenabled in ('O','A'));
$$;
revoke all on function public.enqueue_buyer_brief_notification(text,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_buyer_brief_notifications() from public,anon,authenticated;
revoke all on function public.buyer_brief_notifications_ready() from public,anon,authenticated;
grant execute on function public.enqueue_buyer_brief_notification(text,text,text,text) to service_role;
grant execute on function public.claim_buyer_brief_notifications() to service_role;
grant execute on function public.buyer_brief_notifications_ready() to service_role;
