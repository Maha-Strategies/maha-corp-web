create table if not exists public.cabezon_preview_lifecycles (
  lifecycle_id text primary key check (lifecycle_id ~ '^cbz_[a-f0-9]{32}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  request_sha256 text not null check (request_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  customer_did text not null,
  seller_did text not null,
  offer_id text not null,
  status text not null check (status in ('offered','delivered','acknowledged')),
  lifecycle jsonb not null check (jsonb_typeof(lifecycle) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.cabezon_preview_lifecycle_events (
  event_id bigint generated always as identity primary key,
  lifecycle_id text not null references public.cabezon_preview_lifecycles(lifecycle_id) on delete restrict,
  sequence integer not null check (sequence between 1 and 16),
  event_type text not null check (event_type in ('enquiry_received','offer_returned','delivery_recorded','acknowledgement_recorded')),
  occurred_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  unique (lifecycle_id, sequence)
);

create table if not exists public.cabezon_preview_action_idempotency (
  idempotency_hash text primary key check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  lifecycle_id text not null references public.cabezon_preview_lifecycles(lifecycle_id) on delete restrict,
  request_sha256 text not null check (request_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  action text not null check (action in ('deliver','acknowledge')),
  created_at timestamptz not null default now()
);

alter table public.cabezon_preview_lifecycles enable row level security;
alter table public.cabezon_preview_lifecycle_events enable row level security;
alter table public.cabezon_preview_action_idempotency enable row level security;

revoke all on table public.cabezon_preview_lifecycles, public.cabezon_preview_lifecycle_events, public.cabezon_preview_action_idempotency from public, anon, authenticated;
grant select on table public.cabezon_preview_lifecycles, public.cabezon_preview_lifecycle_events, public.cabezon_preview_action_idempotency to service_role;

create or replace function public.cabezon_preview_forbid_event_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'CABEZON Preview event and idempotency ledgers are append-only.' using errcode = '22023';
end;
$$;

drop trigger if exists cabezon_preview_events_append_only on public.cabezon_preview_lifecycle_events;
create trigger cabezon_preview_events_append_only before update or delete on public.cabezon_preview_lifecycle_events
for each row execute function public.cabezon_preview_forbid_event_mutation();

drop trigger if exists cabezon_preview_actions_append_only on public.cabezon_preview_action_idempotency;
create trigger cabezon_preview_actions_append_only before update or delete on public.cabezon_preview_action_idempotency
for each row execute function public.cabezon_preview_forbid_event_mutation();

create or replace function public.record_cabezon_preview_enquiry(
  p_lifecycle jsonb,
  p_question_sha256 text,
  p_decision_context_sha256 text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lifecycle_id text := p_lifecycle->>'lifecycleId';
  v_existing public.cabezon_preview_lifecycles%rowtype;
  v_event jsonb;
begin
  if v_lifecycle_id !~ '^cbz_[a-f0-9]{32}$'
    or p_lifecycle->>'idempotencyHash' !~ '^sha256:[a-f0-9]{64}$'
    or p_lifecycle->>'requestSha256' !~ '^sha256:[a-f0-9]{64}$'
    or p_question_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or (p_decision_context_sha256 is not null and p_decision_context_sha256 !~ '^sha256:[a-f0-9]{64}$')
    or p_lifecycle->>'status' <> 'offered'
    or jsonb_array_length(p_lifecycle->'events') <> 2
    or p_lifecycle->'deliveryReference' <> 'null'::jsonb
    or p_lifecycle->'acknowledgementSha256' <> 'null'::jsonb
  then raise exception 'Invalid CABEZON Preview enquiry lifecycle.' using errcode = '22023'; end if;

  select * into v_existing from public.cabezon_preview_lifecycles
    where lifecycle_id = v_lifecycle_id or idempotency_hash = p_lifecycle->>'idempotencyHash'
    for update;
  if found then
    if v_existing.lifecycle_id <> v_lifecycle_id
      or v_existing.idempotency_hash <> p_lifecycle->>'idempotencyHash'
      or v_existing.request_sha256 <> p_lifecycle->>'requestSha256'
    then raise exception 'CABEZON Preview idempotency conflict.' using errcode = 'P0001'; end if;
    return jsonb_build_object('status','idempotent','lifecycle',v_existing.lifecycle);
  end if;

  insert into public.cabezon_preview_lifecycles (
    lifecycle_id,idempotency_hash,request_sha256,customer_did,seller_did,offer_id,status,lifecycle,created_at,updated_at
  ) values (
    v_lifecycle_id,p_lifecycle->>'idempotencyHash',p_lifecycle->>'requestSha256',p_lifecycle#>>'{customer,did}',p_lifecycle#>>'{seller,did}',
    p_lifecycle->>'offerId','offered',p_lifecycle,(p_lifecycle->>'createdAt')::timestamptz,(p_lifecycle->>'updatedAt')::timestamptz
  );

  for v_event in select value from jsonb_array_elements(p_lifecycle->'events') loop
    insert into public.cabezon_preview_lifecycle_events (lifecycle_id,sequence,event_type,occurred_at,payload_sha256)
    values (v_lifecycle_id,(v_event->>'sequence')::integer,v_event->>'type',(v_event->>'occurredAt')::timestamptz,v_event->>'payloadSha256');
  end loop;
  return jsonb_build_object('status','created','lifecycle',p_lifecycle);
end;
$$;

create or replace function public.read_cabezon_preview_lifecycle(p_lifecycle_id text)
returns jsonb language sql security invoker set search_path = public stable as $$
  select lifecycle from public.cabezon_preview_lifecycles where lifecycle_id = p_lifecycle_id;
$$;

create or replace function public.record_cabezon_preview_delivery(
  p_lifecycle_id text,
  p_idempotency_hash text,
  p_request_sha256 text,
  p_delivered_at timestamptz,
  p_delivery_reference jsonb,
  p_updated_lifecycle jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.cabezon_preview_lifecycles%rowtype;
  v_action public.cabezon_preview_action_idempotency%rowtype;
  v_prefix jsonb;
  v_event jsonb;
begin
  select * into v_row from public.cabezon_preview_lifecycles where lifecycle_id = p_lifecycle_id for update;
  if not found then raise exception 'CABEZON Preview lifecycle not found.' using errcode = 'P0002'; end if;
  select * into v_action from public.cabezon_preview_action_idempotency where idempotency_hash = p_idempotency_hash;
  if found then
    if v_action.lifecycle_id <> p_lifecycle_id or v_action.request_sha256 <> p_request_sha256 or v_action.action <> 'deliver'
    then raise exception 'CABEZON Preview idempotency conflict.' using errcode = 'P0001'; end if;
    return jsonb_build_object('status','idempotent','lifecycle',v_row.lifecycle);
  end if;
  if v_row.status <> 'offered' then raise exception 'CABEZON Preview lifecycle state invalid.' using errcode = 'P0003'; end if;

  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_prefix
  from jsonb_array_elements(p_updated_lifecycle->'events') with ordinality where ordinality <= jsonb_array_length(v_row.lifecycle->'events');
  if v_prefix <> v_row.lifecycle->'events'
    or jsonb_array_length(p_updated_lifecycle->'events') <> jsonb_array_length(v_row.lifecycle->'events') + 1
    or p_updated_lifecycle->>'status' <> 'delivered'
    or p_updated_lifecycle->>'lifecycleId' <> v_row.lifecycle_id
    or p_updated_lifecycle->>'requestSha256' <> v_row.request_sha256
    or p_updated_lifecycle->'customer' <> v_row.lifecycle->'customer'
    or p_updated_lifecycle->'seller' <> v_row.lifecycle->'seller'
    or p_updated_lifecycle->'deliveryReference' <> p_delivery_reference
    or p_delivery_reference->>'requestSha256' <> v_row.request_sha256
    or p_delivery_reference->>'paymentEnabled' <> 'false'
  then raise exception 'Invalid CABEZON Preview delivery transition.' using errcode = '22023'; end if;

  v_event := p_updated_lifecycle->'events'->(jsonb_array_length(p_updated_lifecycle->'events') - 1);
  if v_event->>'type' <> 'delivery_recorded' then raise exception 'Invalid CABEZON Preview delivery event.' using errcode = '22023'; end if;
  insert into public.cabezon_preview_action_idempotency (idempotency_hash,lifecycle_id,request_sha256,action) values (p_idempotency_hash,p_lifecycle_id,p_request_sha256,'deliver');
  insert into public.cabezon_preview_lifecycle_events (lifecycle_id,sequence,event_type,occurred_at,payload_sha256)
  values (p_lifecycle_id,(v_event->>'sequence')::integer,v_event->>'type',(v_event->>'occurredAt')::timestamptz,v_event->>'payloadSha256');
  update public.cabezon_preview_lifecycles set status='delivered', lifecycle=p_updated_lifecycle, updated_at=p_delivered_at where lifecycle_id=p_lifecycle_id;
  return jsonb_build_object('status','created','lifecycle',p_updated_lifecycle);
end;
$$;

create or replace function public.record_cabezon_preview_acknowledgement(
  p_lifecycle_id text,
  p_idempotency_hash text,
  p_request_sha256 text,
  p_delivery_reference_sha256 text,
  p_acknowledgement_sha256 text,
  p_acknowledged_at timestamptz,
  p_updated_lifecycle jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.cabezon_preview_lifecycles%rowtype;
  v_action public.cabezon_preview_action_idempotency%rowtype;
  v_prefix jsonb;
  v_event jsonb;
begin
  select * into v_row from public.cabezon_preview_lifecycles where lifecycle_id = p_lifecycle_id for update;
  if not found then raise exception 'CABEZON Preview lifecycle not found.' using errcode = 'P0002'; end if;
  select * into v_action from public.cabezon_preview_action_idempotency where idempotency_hash = p_idempotency_hash;
  if found then
    if v_action.lifecycle_id <> p_lifecycle_id or v_action.request_sha256 <> p_request_sha256 or v_action.action <> 'acknowledge'
    then raise exception 'CABEZON Preview idempotency conflict.' using errcode = 'P0001'; end if;
    return jsonb_build_object('status','idempotent','lifecycle',v_row.lifecycle);
  end if;
  if v_row.status <> 'delivered' then raise exception 'CABEZON Preview lifecycle state invalid.' using errcode = 'P0003'; end if;

  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_prefix
  from jsonb_array_elements(p_updated_lifecycle->'events') with ordinality where ordinality <= jsonb_array_length(v_row.lifecycle->'events');
  if v_prefix <> v_row.lifecycle->'events'
    or jsonb_array_length(p_updated_lifecycle->'events') <> jsonb_array_length(v_row.lifecycle->'events') + 1
    or p_updated_lifecycle->>'status' <> 'acknowledged'
    or p_updated_lifecycle->>'lifecycleId' <> v_row.lifecycle_id
    or p_updated_lifecycle->>'requestSha256' <> v_row.request_sha256
    or p_updated_lifecycle->'customer' <> v_row.lifecycle->'customer'
    or p_updated_lifecycle->'seller' <> v_row.lifecycle->'seller'
    or p_updated_lifecycle#>>'{deliveryReference,referenceSha256}' <> p_delivery_reference_sha256
    or p_updated_lifecycle->>'acknowledgementSha256' <> p_acknowledgement_sha256
  then raise exception 'Invalid CABEZON Preview acknowledgement transition.' using errcode = '22023'; end if;

  v_event := p_updated_lifecycle->'events'->(jsonb_array_length(p_updated_lifecycle->'events') - 1);
  if v_event->>'type' <> 'acknowledgement_recorded' then raise exception 'Invalid CABEZON Preview acknowledgement event.' using errcode = '22023'; end if;
  insert into public.cabezon_preview_action_idempotency (idempotency_hash,lifecycle_id,request_sha256,action) values (p_idempotency_hash,p_lifecycle_id,p_request_sha256,'acknowledge');
  insert into public.cabezon_preview_lifecycle_events (lifecycle_id,sequence,event_type,occurred_at,payload_sha256)
  values (p_lifecycle_id,(v_event->>'sequence')::integer,v_event->>'type',(v_event->>'occurredAt')::timestamptz,v_event->>'payloadSha256');
  update public.cabezon_preview_lifecycles set status='acknowledged', lifecycle=p_updated_lifecycle, updated_at=p_acknowledged_at where lifecycle_id=p_lifecycle_id;
  return jsonb_build_object('status','created','lifecycle',p_updated_lifecycle);
end;
$$;

revoke all on function public.record_cabezon_preview_enquiry(jsonb,text,text), public.read_cabezon_preview_lifecycle(text),
  public.record_cabezon_preview_delivery(text,text,text,timestamptz,jsonb,jsonb),
  public.record_cabezon_preview_acknowledgement(text,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.record_cabezon_preview_enquiry(jsonb,text,text), public.read_cabezon_preview_lifecycle(text),
  public.record_cabezon_preview_delivery(text,text,text,timestamptz,jsonb,jsonb),
  public.record_cabezon_preview_acknowledgement(text,text,text,text,text,timestamptz,jsonb) to service_role;
