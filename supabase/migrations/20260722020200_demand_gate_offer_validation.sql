-- Demand is corroborated before a new offer experiment is allowed. This is a
-- human-operated gate: it never republishes client work or grants publishing,
-- spend, deployment, or outreach authority.

create table if not exists public.demand_validation_clusters (
  public_id text primary key check (public_id ~ '^demand_[a-f0-9]{32}$'),
  title text not null check (char_length(title) between 8 and 180),
  buyer text not null check (char_length(buyer) between 3 and 200),
  job_to_be_done text not null check (char_length(job_to_be_done) between 20 and 600),
  offer text not null check (char_length(offer) between 10 and 500),
  status text not null check (status in ('collecting','validated','insufficient_evidence')),
  score integer not null check (score between 0 and 100),
  signal_count integer not null check (signal_count between 0 and 8),
  direct_demand_signals integer not null check (direct_demand_signals between 0 and 8),
  source_channels integer not null check (source_channels between 0 and 5),
  average_commercial_intent numeric(6,2) not null check (average_commercial_intent between 0 and 25),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demand_validation_signals (
  cluster_id text not null references public.demand_validation_clusters(public_id) on delete restrict,
  opportunity_id text not null references public.market_opportunities(public_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (cluster_id, opportunity_id)
);

create table if not exists public.demand_validation_events (
  id uuid primary key default gen_random_uuid(),
  cluster_id text not null references public.demand_validation_clusters(public_id) on delete restrict,
  action text not null check (action = 'created'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (cluster_id, idempotency_hash)
);

create index if not exists demand_validation_clusters_status_score_idx on public.demand_validation_clusters(status, score desc, created_at asc);
alter table public.demand_validation_clusters enable row level security;
alter table public.demand_validation_signals enable row level security;
alter table public.demand_validation_events enable row level security;
revoke all on table public.demand_validation_clusters, public.demand_validation_signals, public.demand_validation_events from public, anon, authenticated;
grant select, insert, update on table public.demand_validation_clusters to service_role;
grant select, insert on table public.demand_validation_signals, public.demand_validation_events to service_role;

create or replace function public.create_demand_validation_cluster(
  p_cluster_id text, p_title text, p_buyer text, p_job_to_be_done text, p_offer text, p_opportunity_ids text[],
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_signal_count integer; v_direct_count integer; v_marketplace_count integer; v_channel_count integer; v_average_intent numeric; v_score integer; v_status text; v_existing public.demand_validation_clusters%rowtype;
begin
  if p_cluster_id !~ '^demand_[a-f0-9]{32}$' or char_length(p_title) not between 8 and 180 or char_length(p_buyer) not between 3 and 200
    or char_length(p_job_to_be_done) not between 20 and 600 or char_length(p_offer) not between 10 and 500
    or coalesce(array_length(p_opportunity_ids, 1), 0) not between 3 and 8
    or (select count(distinct value) from unnest(p_opportunity_ids) as value) <> array_length(p_opportunity_ids, 1)
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid demand validation cluster.' using errcode='22023'; end if;
  select * into v_existing from public.demand_validation_clusters where title=p_title and buyer=p_buyer and offer=p_offer for update;
  if found then return jsonb_build_object('clusterId',v_existing.public_id,'status',v_existing.status,'score',v_existing.score,'idempotentReplay',true); end if;
  if (select count(*) from public.market_opportunities where public_id = any(p_opportunity_ids) and status = 'approved_for_experiment') <> array_length(p_opportunity_ids, 1) then
    raise exception 'All selected signals must be approved market opportunities.' using errcode='P0001';
  end if;
  select count(*), count(*) filter (where signal_class in ('buyer_demand','marketplace_request')), count(*) filter (where signal_class='marketplace_request'), count(distinct source), coalesce(avg(commercial_intent), 0)
    into v_signal_count, v_direct_count, v_marketplace_count, v_channel_count, v_average_intent
    from public.market_opportunities where public_id = any(p_opportunity_ids);
  v_score := least(30, v_signal_count * 10) + least(30, v_direct_count * 15) + case when v_marketplace_count > 0 then 15 else 0 end + least(15, greatest(0, v_channel_count - 1) * 15) + case when v_average_intent >= 12 then 10 when v_average_intent >= 8 then 5 else 0 end;
  v_status := case when v_signal_count >= 3 and v_direct_count >= 2 and v_score >= 70 then 'validated' when v_signal_count >= 3 then 'insufficient_evidence' else 'collecting' end;
  insert into public.demand_validation_clusters (public_id,title,buyer,job_to_be_done,offer,status,score,signal_count,direct_demand_signals,source_channels,average_commercial_intent,created_at,updated_at)
    values (p_cluster_id,p_title,p_buyer,p_job_to_be_done,p_offer,v_status,v_score,v_signal_count,v_direct_count,v_channel_count,v_average_intent,p_at,p_at);
  insert into public.demand_validation_signals(cluster_id,opportunity_id,created_at) select p_cluster_id, value, p_at from unnest(p_opportunity_ids) as value;
  insert into public.demand_validation_events(cluster_id,action,idempotency_hash,actor_fingerprint,created_at) values (p_cluster_id,'created',p_idempotency_hash,p_actor_fingerprint,p_at);
  return jsonb_build_object('clusterId',p_cluster_id,'status',v_status,'score',v_score,'idempotentReplay',false);
end;
$$;

alter table public.growth_experiments drop constraint if exists growth_experiments_source_kind_check;
alter table public.growth_experiments add constraint growth_experiments_source_kind_check check (source_kind in ('market_opportunity','search_performance','manual','demand_cluster'));
alter table public.growth_experiments add column if not exists demand_cluster_id text references public.demand_validation_clusters(public_id) on delete restrict;
create unique index if not exists growth_experiments_demand_cluster_change_idx on public.growth_experiments(demand_cluster_id, target_url, intended_change) where demand_cluster_id is not null;

create or replace function public.create_validated_growth_experiment(
  p_experiment_id text, p_demand_cluster_id text, p_hypothesis text, p_target_url text, p_intended_change text, p_call_to_action text,
  p_primary_kpi text, p_baseline_value numeric, p_baseline_observed_on date, p_measure_after_on date,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_cluster public.demand_validation_clusters%rowtype; v_existing public.growth_experiments%rowtype;
begin
  if p_experiment_id !~ '^experiment_[a-f0-9]{32}$' or p_demand_cluster_id !~ '^demand_[a-f0-9]{32}$'
    or char_length(p_hypothesis) not between 20 and 1000 or p_target_url !~ '^https://www\.mahastrategies\.com/' or char_length(p_intended_change) not between 20 and 1500
    or char_length(p_call_to_action) not between 3 and 160 or p_primary_kpi not in ('impressions','click_through_rate','inquiries','checkout_starts','paid_conversions')
    or p_baseline_value < 0 or p_baseline_observed_on is null or p_measure_after_on < p_baseline_observed_on
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid validated growth experiment.' using errcode='22023'; end if;
  select * into v_cluster from public.demand_validation_clusters where public_id=p_demand_cluster_id for update;
  if not found then raise exception 'Demand cluster not found.' using errcode='P0002'; end if;
  if v_cluster.status <> 'validated' then raise exception 'Demand cluster has not passed the validation gate.' using errcode='P0001'; end if;
  select * into v_existing from public.growth_experiments where demand_cluster_id=p_demand_cluster_id and target_url=p_target_url and intended_change=p_intended_change for update;
  if found then return jsonb_build_object('experimentId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.growth_experiments(public_id,source_kind,source_reference,demand_cluster_id,hypothesis,target_url,intended_change,call_to_action,primary_kpi,baseline_value,baseline_observed_on,measure_after_on,status,created_at,updated_at)
    values(p_experiment_id,'demand_cluster',p_demand_cluster_id,p_demand_cluster_id,p_hypothesis,p_target_url,p_intended_change,p_call_to_action,p_primary_kpi,p_baseline_value,p_baseline_observed_on,p_measure_after_on,'draft',p_at,p_at);
  insert into public.growth_experiment_events(experiment_id,action,idempotency_hash,actor_fingerprint,note,created_at) values(p_experiment_id,'created',p_idempotency_hash,p_actor_fingerprint,'Experiment recorded from a validated demand cluster; no publishing authority granted.',p_at);
  return jsonb_build_object('experimentId',p_experiment_id,'status','draft','idempotentReplay',false);
end;
$$;
revoke all on function public.create_demand_validation_cluster(text,text,text,text,text,text[],text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.create_validated_growth_experiment(text,text,text,text,text,text,text,numeric,date,date,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_demand_validation_cluster(text,text,text,text,text,text[],text,text,timestamptz) to service_role;
grant execute on function public.create_validated_growth_experiment(text,text,text,text,text,text,text,numeric,date,date,text,text,timestamptz) to service_role;
