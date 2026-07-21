-- Evidence-backed opportunity mapping. This records proposals only: it grants
-- no authority to publish, spend money, deploy software, or contact prospects.

create table if not exists public.market_opportunities (
  public_id text primary key check (public_id ~ '^mapopp_[a-f0-9]{32}$'),
  source text not null check (source in ('search_console','llm_query','freelance_market','manual_research','outbound_scout')),
  source_reference text not null check (char_length(source_reference) between 3 and 200),
  title text not null check (char_length(title) between 8 and 180),
  problem text not null check (char_length(problem) between 20 and 1500),
  buyer text not null check (char_length(buyer) between 3 and 200),
  proposed_solution text not null check (char_length(proposed_solution) between 20 and 1500),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 1 and 5),
  demand_evidence integer not null check (demand_evidence between 0 and 30),
  commercial_intent integer not null check (commercial_intent between 0 and 25),
  capability_fit integer not null check (capability_fit between 0 and 20),
  speed_to_validate integer not null check (speed_to_validate between 0 and 15),
  risk_penalty integer not null check (risk_penalty between 0 and 20),
  score integer not null check (score between -20 and 90),
  status text not null default 'discovered' check (status in ('discovered','under_review','approved_for_experiment','rejected','archived')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_reference)
);
create table if not exists public.market_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.market_opportunities(public_id) on delete restrict,
  action text not null check (action in ('discovered','start_review','approve_experiment','reject','archive')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (opportunity_id, idempotency_hash)
);
create index if not exists market_opportunities_queue_idx on public.market_opportunities (status, score desc, created_at asc);
create index if not exists market_opportunity_events_idx on public.market_opportunity_events (opportunity_id, created_at asc);
alter table public.market_opportunities enable row level security;
alter table public.market_opportunity_events enable row level security;
revoke all on table public.market_opportunities, public.market_opportunity_events from public, anon, authenticated;
grant select, insert, update on table public.market_opportunities to service_role;
grant select, insert on table public.market_opportunity_events to service_role;

create or replace function public.create_market_opportunity(
  p_opportunity_id text, p_source text, p_source_reference text, p_title text, p_problem text, p_buyer text, p_proposed_solution text,
  p_evidence jsonb, p_demand_evidence integer, p_commercial_intent integer, p_capability_fit integer, p_speed_to_validate integer, p_risk_penalty integer, p_score integer,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.market_opportunities%rowtype;
begin
  if p_opportunity_id !~ '^mapopp_[a-f0-9]{32}$' or p_source not in ('search_console','llm_query','freelance_market','manual_research','outbound_scout')
    or char_length(p_source_reference) not between 3 and 200 or char_length(p_title) not between 8 and 180 or char_length(p_problem) not between 20 and 1500
    or char_length(p_buyer) not between 3 and 200 or char_length(p_proposed_solution) not between 20 and 1500
    or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) not between 1 and 5
    or p_demand_evidence not between 0 and 30 or p_commercial_intent not between 0 and 25 or p_capability_fit not between 0 and 20 or p_speed_to_validate not between 0 and 15 or p_risk_penalty not between 0 and 20
    or p_score <> p_demand_evidence + p_commercial_intent + p_capability_fit + p_speed_to_validate - p_risk_penalty
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid market opportunity.' using errcode='22023'; end if;
  select * into v_existing from public.market_opportunities where source=p_source and source_reference=p_source_reference for update;
  if found then return jsonb_build_object('opportunityId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.market_opportunities (public_id,source,source_reference,title,problem,buyer,proposed_solution,evidence,demand_evidence,commercial_intent,capability_fit,speed_to_validate,risk_penalty,score,status,created_at,updated_at)
    values (p_opportunity_id,p_source,p_source_reference,p_title,p_problem,p_buyer,p_proposed_solution,p_evidence,p_demand_evidence,p_commercial_intent,p_capability_fit,p_speed_to_validate,p_risk_penalty,p_score,'discovered',p_at,p_at);
  insert into public.market_opportunity_events (opportunity_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_opportunity_id,'discovered',p_idempotency_hash,p_actor_fingerprint,'Evidence-backed opportunity recorded.',p_at);
  return jsonb_build_object('opportunityId',p_opportunity_id,'status','discovered','idempotentReplay',false);
end;
$$;

create or replace function public.operate_market_opportunity(
  p_opportunity_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_opportunity public.market_opportunities%rowtype; v_event public.market_opportunity_events%rowtype; v_status text;
begin
  if p_opportunity_id !~ '^mapopp_[a-f0-9]{32}$' or p_action not in ('start_review','approve_experiment','reject','archive')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000) then raise exception 'Invalid market operation.' using errcode='22023'; end if;
  select * into v_opportunity from public.market_opportunities where public_id=p_opportunity_id for update;
  if not found then raise exception 'Market opportunity not found.' using errcode='P0002'; end if;
  select * into v_event from public.market_opportunity_events where opportunity_id=p_opportunity_id and idempotency_hash=p_idempotency_hash;
  if found then return jsonb_build_object('opportunityId',p_opportunity_id,'status',v_opportunity.status,'idempotentReplay',true); end if;
  v_status := case p_action when 'start_review' then 'under_review' when 'approve_experiment' then 'approved_for_experiment' when 'reject' then 'rejected' else 'archived' end;
  if not ((p_action='start_review' and v_opportunity.status='discovered') or (p_action='approve_experiment' and v_opportunity.status='under_review') or (p_action='reject' and v_opportunity.status in ('discovered','under_review')) or (p_action='archive' and v_opportunity.status in ('discovered','under_review','rejected'))) then
    raise exception 'Operation is not allowed for the current market state.' using errcode='P0001';
  end if;
  insert into public.market_opportunity_events (opportunity_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_opportunity_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.market_opportunities set status=v_status, reviewer_note=nullif(p_note,''), updated_at=p_at where public_id=p_opportunity_id;
  return jsonb_build_object('opportunityId',p_opportunity_id,'status',v_status,'idempotentReplay',false);
end;
$$;
revoke all on function public.create_market_opportunity(text,text,text,text,text,text,text,jsonb,integer,integer,integer,integer,integer,integer,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.operate_market_opportunity(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_market_opportunity(text,text,text,text,text,text,text,jsonb,integer,integer,integer,integer,integer,integer,text,text,timestamptz) to service_role;
grant execute on function public.operate_market_opportunity(text,text,text,text,text,timestamptz) to service_role;
