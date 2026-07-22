-- Human-reviewed SOM and unit-economics evaluations. Inputs are stated
-- assumptions; the database calculates the recommendation deterministically.

create table if not exists public.som_evaluations (
  public_id text primary key check (public_id ~ '^som_[a-f0-9]{32}$'),
  demand_cluster_id text not null references public.demand_validation_clusters(public_id) on delete restrict,
  decision text not null check (decision in ('build_candidate','validate_first','reject')),
  score integer not null check (score between 0 and 100),
  price_cents integer not null check (price_cents between 100 and 10000000),
  variable_cost_cents integer not null check (variable_cost_cents between 0 and 10000000),
  monthly_operating_cost_cents integer not null check (monthly_operating_cost_cents between 0 and 100000000),
  one_time_build_cost_cents integer not null check (one_time_build_cost_cents between 0 and 100000000),
  expected_monthly_qualified_demand integer not null check (expected_monthly_qualified_demand between 0 and 1000000),
  expected_conversion_rate_bps integer not null check (expected_conversion_rate_bps between 1 and 10000),
  expected_monthly_orders numeric(16,4) not null check (expected_monthly_orders >= 0),
  expected_monthly_revenue_cents numeric(18,2) not null,
  expected_monthly_contribution_cents numeric(18,2) not null,
  gross_margin_percent numeric(8,2) not null,
  payback_months numeric(16,4),
  competitor_pressure integer not null check (competitor_pressure between 0 and 10),
  willingness_to_pay_evidence integer not null check (willingness_to_pay_evidence between 0 and 10),
  policy_risk integer not null check (policy_risk between 0 and 10),
  assumption_note text not null check (char_length(assumption_note) between 30 and 1000),
  created_at timestamptz not null default now(),
  unique (demand_cluster_id, price_cents, variable_cost_cents, monthly_operating_cost_cents, one_time_build_cost_cents, expected_monthly_qualified_demand, expected_conversion_rate_bps, competitor_pressure, willingness_to_pay_evidence, policy_risk)
);
create table if not exists public.som_evaluation_events (
  id uuid primary key default gen_random_uuid(), evaluation_id text not null references public.som_evaluations(public_id) on delete restrict,
  action text not null check (action = 'created'), idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'), actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'), created_at timestamptz not null default now(), unique (evaluation_id, idempotency_hash)
);
alter table public.som_evaluations enable row level security;
alter table public.som_evaluation_events enable row level security;
revoke all on table public.som_evaluations, public.som_evaluation_events from public, anon, authenticated;
grant select, insert on table public.som_evaluations, public.som_evaluation_events to service_role;

create or replace function public.create_som_evaluation(
  p_evaluation_id text, p_demand_cluster_id text, p_price_cents integer, p_variable_cost_cents integer, p_monthly_operating_cost_cents integer, p_one_time_build_cost_cents integer,
  p_expected_monthly_qualified_demand integer, p_expected_conversion_rate_bps integer, p_competitor_pressure integer, p_willingness_to_pay_evidence integer, p_policy_risk integer, p_assumption_note text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_cluster public.demand_validation_clusters%rowtype; v_existing public.som_evaluations%rowtype; v_orders numeric; v_revenue numeric; v_contribution numeric; v_margin numeric; v_payback numeric; v_score integer; v_decision text;
begin
  if p_evaluation_id !~ '^som_[a-f0-9]{32}$' or p_demand_cluster_id !~ '^demand_[a-f0-9]{32}$' or p_price_cents not between 100 and 10000000 or p_variable_cost_cents not between 0 and 10000000 or p_monthly_operating_cost_cents not between 0 and 100000000 or p_one_time_build_cost_cents not between 0 and 100000000 or p_expected_monthly_qualified_demand not between 0 and 1000000 or p_expected_conversion_rate_bps not between 1 and 10000 or p_competitor_pressure not between 0 and 10 or p_willingness_to_pay_evidence not between 0 and 10 or p_policy_risk not between 0 and 10 or char_length(p_assumption_note) not between 30 and 1000 or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null then raise exception 'Invalid SOM evaluation.' using errcode='22023'; end if;
  select * into v_cluster from public.demand_validation_clusters where public_id=p_demand_cluster_id for update;
  if not found then raise exception 'Demand cluster not found.' using errcode='P0002'; end if;
  if v_cluster.status <> 'validated' then raise exception 'Demand cluster has not passed the validation gate.' using errcode='P0001'; end if;
  select * into v_existing from public.som_evaluations where demand_cluster_id=p_demand_cluster_id and price_cents=p_price_cents and variable_cost_cents=p_variable_cost_cents and monthly_operating_cost_cents=p_monthly_operating_cost_cents and one_time_build_cost_cents=p_one_time_build_cost_cents and expected_monthly_qualified_demand=p_expected_monthly_qualified_demand and expected_conversion_rate_bps=p_expected_conversion_rate_bps and competitor_pressure=p_competitor_pressure and willingness_to_pay_evidence=p_willingness_to_pay_evidence and policy_risk=p_policy_risk for update;
  if found then return jsonb_build_object('evaluationId',v_existing.public_id,'decision',v_existing.decision,'score',v_existing.score,'idempotentReplay',true); end if;
  v_orders := p_expected_monthly_qualified_demand::numeric * p_expected_conversion_rate_bps / 10000;
  v_revenue := v_orders * p_price_cents;
  v_contribution := v_revenue - v_orders * p_variable_cost_cents - p_monthly_operating_cost_cents;
  v_margin := (p_price_cents - p_variable_cost_cents)::numeric / p_price_cents * 100;
  v_payback := case when v_contribution > 0 then p_one_time_build_cost_cents::numeric / v_contribution else null end;
  v_score := greatest(0, least(100, round(v_cluster.score * .3)::integer + case when v_contribution > 0 then 15 else 0 end + case when v_margin >= 70 then 15 when v_margin >= 50 then 10 else 0 end + case when v_payback is not null and v_payback <= 6 then 15 when v_payback is not null and v_payback <= 12 then 10 else 0 end + p_willingness_to_pay_evidence + (10 - p_competitor_pressure) + (10 - p_policy_risk)));
  v_decision := case when p_policy_risk >= 8 or v_contribution <= 0 or v_margin < 30 then 'reject' when p_willingness_to_pay_evidence < 5 or p_expected_monthly_qualified_demand < 5 or v_payback is null or v_payback > 12 or p_policy_risk > 4 then 'validate_first' else 'build_candidate' end;
  insert into public.som_evaluations(public_id,demand_cluster_id,decision,score,price_cents,variable_cost_cents,monthly_operating_cost_cents,one_time_build_cost_cents,expected_monthly_qualified_demand,expected_conversion_rate_bps,expected_monthly_orders,expected_monthly_revenue_cents,expected_monthly_contribution_cents,gross_margin_percent,payback_months,competitor_pressure,willingness_to_pay_evidence,policy_risk,assumption_note,created_at) values(p_evaluation_id,p_demand_cluster_id,v_decision,v_score,p_price_cents,p_variable_cost_cents,p_monthly_operating_cost_cents,p_one_time_build_cost_cents,p_expected_monthly_qualified_demand,p_expected_conversion_rate_bps,v_orders,v_revenue,v_contribution,v_margin,v_payback,p_competitor_pressure,p_willingness_to_pay_evidence,p_policy_risk,p_assumption_note,p_at);
  insert into public.som_evaluation_events(evaluation_id,action,idempotency_hash,actor_fingerprint,created_at) values(p_evaluation_id,'created',p_idempotency_hash,p_actor_fingerprint,p_at);
  return jsonb_build_object('evaluationId',p_evaluation_id,'decision',v_decision,'score',v_score,'idempotentReplay',false);
end;
$$;
revoke all on function public.create_som_evaluation(text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_som_evaluation(text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,text,text,timestamptz) to service_role;
