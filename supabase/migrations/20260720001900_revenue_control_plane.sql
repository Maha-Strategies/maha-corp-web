-- Private, append-only commercial outcome ledger. This deliberately has no
-- payment authority, email-sending capability, wallet, or public RLS policy.

create table if not exists public.revenue_opportunities (
  public_id text primary key check (public_id ~ '^revopp_[a-f0-9]{32}$'),
  source_type text not null check (source_type in ('agent_inquiry', 'website_contact', 'manual_operator')),
  source_reference text not null check (char_length(source_reference) between 3 and 200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  offer_id text not null check (offer_id in (
    'mps-prepaid-audit-access', 'mps-preflight',
    'book-the-imagined-life', 'book-the-orbital-mind', 'book-the-synthetic-self', 'book-the-unfinished-species',
    'rapid-intelligence-brief', 'verified-research-brief'
  )),
  signal_hash text not null check (signal_hash ~ '^sha256:[a-f0-9]{64}$'),
  route text not null check (route in ('self_service_checkout', 'human_scope_review')),
  qualified boolean not null,
  qualification_reasons text[] not null default '{}'::text[],
  status text not null check (status in ('routed', 'awaiting_human_review', 'checkout_started', 'paid', 'delivered', 'refunded', 'declined', 'closed_lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_reference)
);

create table if not exists public.revenue_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.revenue_opportunities(public_id) on delete restrict,
  event_type text not null check (event_type in ('routed', 'human_review_started', 'checkout_started', 'paid', 'delivered', 'refunded', 'declined', 'closed_lost')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  reason text not null check (char_length(reason) between 3 and 500),
  reference_id text not null check (char_length(reference_id) between 3 and 200),
  amount_cents integer check (amount_cents is null or amount_cents > 0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (opportunity_id, idempotency_hash)
);

create index if not exists revenue_opportunities_status_created_at_idx on public.revenue_opportunities (status, created_at desc);
create index if not exists revenue_opportunities_offer_created_at_idx on public.revenue_opportunities (offer_id, created_at desc);
create index if not exists revenue_opportunity_events_opportunity_created_at_idx on public.revenue_opportunity_events (opportunity_id, created_at asc);

alter table public.revenue_opportunities enable row level security;
alter table public.revenue_opportunity_events enable row level security;
revoke all on table public.revenue_opportunities, public.revenue_opportunity_events from public, anon, authenticated;
grant select, insert, update on table public.revenue_opportunities to service_role;
grant select, insert on table public.revenue_opportunity_events to service_role;

create or replace function public.create_revenue_opportunity(
  p_opportunity_id text, p_source_type text, p_source_reference text, p_source_url text,
  p_offer_id text, p_signal_hash text, p_route text, p_qualified boolean,
  p_qualification_reasons text[], p_idempotency_hash text, p_actor_fingerprint text, p_reason text, p_reference_id text,
  p_created_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare v_existing public.revenue_opportunities%rowtype;
begin
  if p_opportunity_id !~ '^revopp_[a-f0-9]{32}$' or p_signal_hash !~ '^sha256:[a-f0-9]{64}$' or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'Invalid revenue opportunity identifiers.' using errcode = '22023';
  end if;
  select * into v_existing from public.revenue_opportunities where source_type = p_source_type and source_reference = p_source_reference for update;
  if found then
    if v_existing.offer_id <> p_offer_id or v_existing.signal_hash <> p_signal_hash then
      raise exception 'A different revenue signal already uses this source reference.' using errcode = '23505';
    end if;
    return jsonb_build_object('opportunityId', v_existing.public_id, 'status', v_existing.status, 'idempotentReplay', true);
  end if;

  insert into public.revenue_opportunities (public_id, source_type, source_reference, source_url, offer_id, signal_hash, route, qualified, qualification_reasons, status, created_at, updated_at)
  values (p_opportunity_id, p_source_type, p_source_reference, p_source_url, p_offer_id, p_signal_hash, p_route, p_qualified, p_qualification_reasons,
    case when p_route = 'self_service_checkout' then 'routed' else 'awaiting_human_review' end, p_created_at, p_created_at);
  insert into public.revenue_opportunity_events (opportunity_id, event_type, idempotency_hash, actor_fingerprint, reason, reference_id, metadata, created_at)
  values (p_opportunity_id, 'routed', p_idempotency_hash, p_actor_fingerprint, p_reason, p_reference_id,
    jsonb_build_object('offerId', p_offer_id, 'route', p_route, 'qualified', p_qualified, 'qualificationReasons', p_qualification_reasons), p_created_at);
  return jsonb_build_object('opportunityId', p_opportunity_id, 'status', case when p_route = 'self_service_checkout' then 'routed' else 'awaiting_human_review' end, 'idempotentReplay', false);
end;
$$;

create or replace function public.record_revenue_opportunity_outcome(
  p_opportunity_id text, p_event_type text, p_idempotency_hash text, p_actor_fingerprint text,
  p_reason text, p_reference_id text, p_amount_cents integer, p_currency text, p_created_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare v_opportunity public.revenue_opportunities%rowtype; v_existing public.revenue_opportunity_events%rowtype;
begin
  select * into v_opportunity from public.revenue_opportunities where public_id = p_opportunity_id for update;
  if not found then raise exception 'Revenue opportunity not found.' using errcode = 'P0002'; end if;
  select * into v_existing from public.revenue_opportunity_events where opportunity_id = p_opportunity_id and idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('opportunityId', p_opportunity_id, 'status', v_opportunity.status, 'idempotentReplay', true); end if;
  if p_event_type in ('paid', 'refunded') and (p_amount_cents is null or p_amount_cents < 1 or p_currency is null or p_currency !~ '^[a-z]{3}$') then
    raise exception 'Paid and refunded outcomes require a positive amount and currency.' using errcode = '22023';
  end if;
  if not (
    (p_event_type = 'human_review_started' and v_opportunity.status = 'awaiting_human_review') or
    (p_event_type = 'checkout_started' and v_opportunity.status in ('routed', 'awaiting_human_review')) or
    (p_event_type = 'paid' and v_opportunity.status = 'checkout_started') or
    (p_event_type = 'delivered' and v_opportunity.status = 'paid') or
    (p_event_type = 'refunded' and v_opportunity.status in ('paid', 'delivered')) or
    (p_event_type in ('declined', 'closed_lost') and v_opportunity.status in ('routed', 'awaiting_human_review', 'checkout_started'))
  ) then raise exception 'Outcome is not allowed for the current revenue state.' using errcode = 'P0001'; end if;
  insert into public.revenue_opportunity_events (opportunity_id, event_type, idempotency_hash, actor_fingerprint, reason, reference_id, amount_cents, currency, created_at)
  values (p_opportunity_id, p_event_type, p_idempotency_hash, p_actor_fingerprint, p_reason, p_reference_id, p_amount_cents, p_currency, p_created_at);
  update public.revenue_opportunities
    set status = case when p_event_type = 'human_review_started' then status else p_event_type end,
        updated_at = p_created_at
    where public_id = p_opportunity_id;
  return jsonb_build_object('opportunityId', p_opportunity_id, 'status', case when p_event_type = 'human_review_started' then v_opportunity.status else p_event_type end, 'idempotentReplay', false);
end;
$$;

revoke all on function public.create_revenue_opportunity(text,text,text,text,text,text,text,boolean,text[],text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.record_revenue_opportunity_outcome(text,text,text,text,text,text,integer,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_revenue_opportunity(text,text,text,text,text,text,text,boolean,text[],text,text,text,text,timestamptz) to service_role;
grant execute on function public.record_revenue_opportunity_outcome(text,text,text,text,text,text,integer,text,timestamptz) to service_role;
