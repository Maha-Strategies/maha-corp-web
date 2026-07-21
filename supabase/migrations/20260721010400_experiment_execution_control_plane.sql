-- Human-operated experiment lifecycle. It records hypotheses and outcomes but
-- deliberately grants no publishing, spend, outreach, or deployment authority.

create table if not exists public.growth_experiments (
  public_id text primary key check (public_id ~ '^experiment_[a-f0-9]{32}$'),
  source_kind text not null check (source_kind in ('market_opportunity','search_performance','manual')),
  source_reference text not null check (char_length(source_reference) between 3 and 200),
  hypothesis text not null check (char_length(hypothesis) between 20 and 1000),
  target_url text not null check (target_url ~ '^https://www\.mahastrategies\.com/'),
  intended_change text not null check (char_length(intended_change) between 20 and 1500),
  call_to_action text not null check (char_length(call_to_action) between 3 and 160),
  primary_kpi text not null check (primary_kpi in ('impressions','click_through_rate','inquiries','checkout_starts','paid_conversions')),
  baseline_value numeric(12,4) not null check (baseline_value >= 0),
  baseline_observed_on date not null,
  measure_after_on date not null,
  status text not null default 'draft' check (status in ('draft','approved','prepared','measuring','retained','iterating','retired')),
  outcome_value numeric(12,4) check (outcome_value >= 0),
  outcome_note text,
  approved_at timestamptz,
  prepared_at timestamptz,
  published_at timestamptz,
  measured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_kind, source_reference, target_url, intended_change)
);

create table if not exists public.growth_experiment_events (
  id uuid primary key default gen_random_uuid(),
  experiment_id text not null references public.growth_experiments(public_id) on delete restrict,
  action text not null check (action in ('created','approve','mark_prepared','confirm_published','retain','iterate','retire')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (experiment_id, idempotency_hash)
);

create index if not exists growth_experiments_status_measure_idx on public.growth_experiments (status, measure_after_on asc);
create index if not exists growth_experiment_events_experiment_idx on public.growth_experiment_events (experiment_id, created_at asc);
alter table public.growth_experiments enable row level security;
alter table public.growth_experiment_events enable row level security;
revoke all on table public.growth_experiments, public.growth_experiment_events from public, anon, authenticated;
grant select, insert, update on table public.growth_experiments to service_role;
grant select, insert on table public.growth_experiment_events to service_role;

create or replace function public.create_growth_experiment(
  p_experiment_id text, p_source_kind text, p_source_reference text, p_hypothesis text, p_target_url text, p_intended_change text, p_call_to_action text,
  p_primary_kpi text, p_baseline_value numeric, p_baseline_observed_on date, p_measure_after_on date,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.growth_experiments%rowtype;
begin
  if p_experiment_id !~ '^experiment_[a-f0-9]{32}$' or p_source_kind not in ('market_opportunity','search_performance','manual')
    or char_length(p_source_reference) not between 3 and 200 or char_length(p_hypothesis) not between 20 and 1000
    or p_target_url !~ '^https://www\.mahastrategies\.com/' or char_length(p_intended_change) not between 20 and 1500
    or char_length(p_call_to_action) not between 3 and 160 or p_primary_kpi not in ('impressions','click_through_rate','inquiries','checkout_starts','paid_conversions')
    or p_baseline_value < 0 or p_baseline_observed_on is null or p_measure_after_on < p_baseline_observed_on
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid growth experiment.' using errcode='22023'; end if;
  select * into v_existing from public.growth_experiments where source_kind=p_source_kind and source_reference=p_source_reference and target_url=p_target_url and intended_change=p_intended_change for update;
  if found then return jsonb_build_object('experimentId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.growth_experiments (public_id,source_kind,source_reference,hypothesis,target_url,intended_change,call_to_action,primary_kpi,baseline_value,baseline_observed_on,measure_after_on,status,created_at,updated_at)
    values (p_experiment_id,p_source_kind,p_source_reference,p_hypothesis,p_target_url,p_intended_change,p_call_to_action,p_primary_kpi,p_baseline_value,p_baseline_observed_on,p_measure_after_on,'draft',p_at,p_at);
  insert into public.growth_experiment_events (experiment_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_experiment_id,'created',p_idempotency_hash,p_actor_fingerprint,'Experiment recorded; no publishing authority granted.',p_at);
  return jsonb_build_object('experimentId',p_experiment_id,'status','draft','idempotentReplay',false);
end;
$$;

create or replace function public.operate_growth_experiment(
  p_experiment_id text, p_action text, p_note text, p_outcome_value numeric, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_experiment public.growth_experiments%rowtype; v_status text;
begin
  if p_experiment_id !~ '^experiment_[a-f0-9]{32}$' or p_action not in ('approve','mark_prepared','confirm_published','retain','iterate','retire')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000) or (p_outcome_value is not null and p_outcome_value < 0)
  then raise exception 'Invalid growth experiment operation.' using errcode='22023'; end if;
  select * into v_experiment from public.growth_experiments where public_id=p_experiment_id for update;
  if not found then raise exception 'Growth experiment not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.growth_experiment_events where experiment_id=p_experiment_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('experimentId',p_experiment_id,'status',v_experiment.status,'idempotentReplay',true); end if;
  if p_action in ('retain','iterate','retire') and p_at::date < v_experiment.measure_after_on then raise exception 'Measurement window has not yet opened.' using errcode='P0001'; end if;
  v_status := case p_action when 'approve' then 'approved' when 'mark_prepared' then 'prepared' when 'confirm_published' then 'measuring' when 'retain' then 'retained' when 'iterate' then 'iterating' else 'retired' end;
  if not ((p_action='approve' and v_experiment.status='draft') or (p_action='mark_prepared' and v_experiment.status='approved') or (p_action='confirm_published' and v_experiment.status='prepared') or (p_action in ('retain','iterate','retire') and v_experiment.status='measuring')) then raise exception 'Operation is not allowed for the current experiment state.' using errcode='P0001'; end if;
  insert into public.growth_experiment_events (experiment_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_experiment_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.growth_experiments set status=v_status, outcome_value=case when p_action in ('retain','iterate','retire') then p_outcome_value else outcome_value end, outcome_note=case when p_action in ('retain','iterate','retire') then nullif(p_note,'') else outcome_note end, approved_at=case when p_action='approve' then p_at else approved_at end, prepared_at=case when p_action='mark_prepared' then p_at else prepared_at end, published_at=case when p_action='confirm_published' then p_at else published_at end, measured_at=case when p_action in ('retain','iterate','retire') then p_at else measured_at end, updated_at=p_at where public_id=p_experiment_id;
  return jsonb_build_object('experimentId',p_experiment_id,'status',v_status,'idempotentReplay',false);
end;
$$;
revoke all on function public.create_growth_experiment(text,text,text,text,text,text,text,text,numeric,date,date,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.operate_growth_experiment(text,text,text,numeric,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_growth_experiment(text,text,text,text,text,text,text,text,numeric,date,date,text,text,timestamptz) to service_role;
grant execute on function public.operate_growth_experiment(text,text,text,numeric,text,text,timestamptz) to service_role;
