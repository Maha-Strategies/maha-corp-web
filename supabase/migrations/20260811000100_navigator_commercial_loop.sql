-- Prospect-scoped commercial-loop evidence for Maha Navigator. Discovery and
-- pursue approval are captured from the research ledger. Every later stage is
-- an explicit operator reconciliation: this migration does not send outreach,
-- inspect offers, charge a buyer, or deliver a product.

create table if not exists public.navigator_commercial_loop_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.navigator_research_candidates(public_id) on delete restrict,
  stage text not null check (stage in ('discovered','recommendation_approved','message_sent','reply_received','offer_inspected','payment_confirmed','delivery_succeeded','repeat_purchase')),
  offer_id text check (offer_id is null or char_length(offer_id) between 3 and 160),
  channel text check (channel is null or channel in ('email','linkedin','reddit','registry','direct','other')),
  reference_hash text check (reference_hash is null or reference_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_type text not null check (actor_type in ('system','operator')),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists navigator_commercial_loop_candidate_idx on public.navigator_commercial_loop_events (candidate_id, created_at asc);
create index if not exists navigator_commercial_loop_stage_idx on public.navigator_commercial_loop_events (stage, created_at asc);
create unique index if not exists navigator_commercial_loop_discovered_once on public.navigator_commercial_loop_events (candidate_id) where stage='discovered';
create unique index if not exists navigator_commercial_loop_approved_once on public.navigator_commercial_loop_events (candidate_id) where stage='recommendation_approved';
create unique index if not exists navigator_commercial_loop_repeat_once on public.navigator_commercial_loop_events (candidate_id) where stage='repeat_purchase';
create unique index if not exists navigator_commercial_loop_payment_reference_once on public.navigator_commercial_loop_events (reference_hash) where stage='payment_confirmed';
create unique index if not exists navigator_commercial_loop_delivery_reference_once on public.navigator_commercial_loop_events (reference_hash) where stage='delivery_succeeded';

alter table public.navigator_commercial_loop_events enable row level security;
revoke all on table public.navigator_commercial_loop_events from public, anon, authenticated;
grant select on table public.navigator_commercial_loop_events to service_role;
revoke insert, update, delete, truncate on table public.navigator_commercial_loop_events from service_role;

create or replace function public.navigator_capture_commercial_research_event()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_stage text;
  v_key text;
  v_system text := 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
begin
  if tg_op='INSERT' then
    v_stage := 'discovered';
  elsif tg_op='UPDATE' and new.disposition='pursue' and old.disposition is distinct from 'pursue' then
    v_stage := 'recommendation_approved';
  else
    return new;
  end if;
  v_key := 'sha256:' || encode(digest('navigator-commercial-loop:' || v_stage || ':' || new.public_id, 'sha256'), 'hex');
  insert into public.navigator_commercial_loop_events
    (candidate_id,stage,actor_type,actor_fingerprint,idempotency_hash,created_at)
  values (new.public_id,v_stage,'system',v_system,v_key,case when v_stage='discovered' then new.created_at else coalesce(new.reviewed_at,new.updated_at) end)
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists navigator_capture_commercial_candidate_insert on public.navigator_research_candidates;
create trigger navigator_capture_commercial_candidate_insert
after insert on public.navigator_research_candidates
for each row execute function public.navigator_capture_commercial_research_event();

drop trigger if exists navigator_capture_commercial_candidate_approval on public.navigator_research_candidates;
create trigger navigator_capture_commercial_candidate_approval
after update of disposition on public.navigator_research_candidates
for each row execute function public.navigator_capture_commercial_research_event();

-- Existing research candidates enter the ledger without rewriting their
-- research history. Pursue decisions retain the recorded review timestamp.
insert into public.navigator_commercial_loop_events
  (candidate_id,stage,actor_type,actor_fingerprint,idempotency_hash,created_at)
select public_id,'discovered','system',
  'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  'sha256:' || encode(digest('navigator-commercial-loop:discovered:' || public_id, 'sha256'), 'hex'),created_at
from public.navigator_research_candidates on conflict do nothing;

insert into public.navigator_commercial_loop_events
  (candidate_id,stage,actor_type,actor_fingerprint,idempotency_hash,created_at)
select public_id,'recommendation_approved','system',
  'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  'sha256:' || encode(digest('navigator-commercial-loop:recommendation_approved:' || public_id, 'sha256'), 'hex'),coalesce(reviewed_at,updated_at)
from public.navigator_research_candidates where disposition='pursue' on conflict do nothing;

create or replace function public.record_navigator_commercial_event(
  p_candidate_id text, p_stage text, p_offer_id text, p_channel text,
  p_reference_hash text, p_idempotency_hash text, p_actor_fingerprint text,
  p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_candidate public.navigator_research_candidates%rowtype;
  v_existing public.navigator_commercial_loop_events%rowtype;
  v_event_id uuid;
  v_payment_count integer;
  v_repeat_key text;
begin
  if p_candidate_id !~ '^navacct_[a-f0-9]{32}$'
    or p_stage not in ('message_sent','reply_received','offer_inspected','payment_confirmed','delivery_succeeded')
    or (p_offer_id is not null and char_length(p_offer_id) not between 3 and 160)
    or (p_channel is not null and p_channel not in ('email','linkedin','reddit','registry','direct','other'))
    or (p_reference_hash is not null and p_reference_hash !~ '^sha256:[a-f0-9]{64}$')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
    or p_at is null
  then raise exception 'Invalid Navigator commercial event.' using errcode='22023'; end if;

  select * into v_existing from public.navigator_commercial_loop_events where idempotency_hash=p_idempotency_hash;
  if found then return jsonb_build_object('eventId',v_existing.id,'candidateId',v_existing.candidate_id,'stage',v_existing.stage,'idempotentReplay',true); end if;
  select * into v_candidate from public.navigator_research_candidates where public_id=p_candidate_id for update;
  if not found then raise exception 'Navigator candidate not found.' using errcode='P0002'; end if;
  if not exists(select 1 from public.navigator_commercial_loop_events where candidate_id=p_candidate_id and stage='recommendation_approved') then
    raise exception 'Human pursue approval is required before recording commercial activity.' using errcode='P0001';
  end if;
  if p_stage in ('message_sent','reply_received') and p_channel is null then raise exception 'A communication channel is required.' using errcode='22023'; end if;
  if p_stage='reply_received' and not exists(select 1 from public.navigator_commercial_loop_events where candidate_id=p_candidate_id and stage='message_sent') then
    raise exception 'A reply requires a recorded message.' using errcode='P0001';
  end if;
  if p_stage in ('offer_inspected','payment_confirmed','delivery_succeeded') and p_offer_id is null then raise exception 'An offer is required.' using errcode='22023'; end if;
  if p_stage in ('payment_confirmed','delivery_succeeded') and p_reference_hash is null then raise exception 'A payment reference is required.' using errcode='22023'; end if;
  if p_stage='payment_confirmed' and not exists(select 1 from public.navigator_commercial_loop_events where candidate_id=p_candidate_id and stage='offer_inspected' and offer_id=p_offer_id) then
    raise exception 'Payment requires an attributed offer inspection.' using errcode='P0001';
  end if;
  if p_stage='delivery_succeeded' and not exists(select 1 from public.navigator_commercial_loop_events where candidate_id=p_candidate_id and stage='payment_confirmed' and offer_id=p_offer_id and reference_hash=p_reference_hash) then
    raise exception 'Delivery requires the matching confirmed payment.' using errcode='P0001';
  end if;

  insert into public.navigator_commercial_loop_events
    (candidate_id,stage,offer_id,channel,reference_hash,actor_type,actor_fingerprint,idempotency_hash,created_at)
  values (p_candidate_id,p_stage,p_offer_id,p_channel,p_reference_hash,'operator',p_actor_fingerprint,p_idempotency_hash,p_at)
  returning id into v_event_id;

  if p_stage in ('payment_confirmed','delivery_succeeded') then
    select count(distinct reference_hash) into v_payment_count from public.navigator_commercial_loop_events
      where candidate_id=p_candidate_id and stage='payment_confirmed' and reference_hash is not null;
    if v_payment_count >= 2 and exists(
      select 1 from public.navigator_commercial_loop_events
      where candidate_id=p_candidate_id and stage='delivery_succeeded'
    ) then
      v_repeat_key := 'sha256:' || encode(digest('navigator-commercial-loop:repeat_purchase:' || p_candidate_id, 'sha256'), 'hex');
      insert into public.navigator_commercial_loop_events
        (candidate_id,stage,offer_id,actor_type,actor_fingerprint,idempotency_hash,created_at)
      values (p_candidate_id,'repeat_purchase',p_offer_id,'system',p_actor_fingerprint,v_repeat_key,p_at)
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('eventId',v_event_id,'candidateId',p_candidate_id,'stage',p_stage,'repeatPurchase',
    coalesce(v_payment_count,0)>=2 and exists(select 1 from public.navigator_commercial_loop_events where candidate_id=p_candidate_id and stage='repeat_purchase'),
    'idempotentReplay',false);
end; $$;

revoke all on function public.navigator_capture_commercial_research_event() from public, anon, authenticated;
revoke all on function public.record_navigator_commercial_event(text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_navigator_commercial_event(text,text,text,text,text,text,text,timestamptz) to service_role;

comment on table public.navigator_commercial_loop_events is 'Append-only, prospect-scoped commercial stage evidence. Stores hashes and categorical attribution only; never message bodies, reply text, contact details, or wallet addresses.';
comment on column public.navigator_commercial_loop_events.reference_hash is 'One-way hash of an operator-supplied payment or delivery reference. The raw external identifier is not retained.';
