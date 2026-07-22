-- A $5–$20 micro-utility launch is an explicit, measured human experiment.
-- It does not create software, change Stripe prices, publish pages, or spend.
create table if not exists public.micro_utility_validations (
  public_id text primary key check (public_id ~ '^microval_[a-f0-9]{32}$'),
  som_evaluation_id text not null references public.som_evaluations(public_id) on delete restrict,
  experiment_id text not null references public.growth_experiments(public_id) on delete restrict,
  utility text not null check (utility = 'receipts_to_csv'),
  target_price_cents integer not null check (target_price_cents between 500 and 2000),
  target_paid_orders integer not null check (target_paid_orders between 5 and 100),
  measure_after_on date not null,
  status text not null default 'draft' check (status in ('draft','approved','measuring','retained','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (som_evaluation_id, experiment_id, utility)
);
create table if not exists public.micro_utility_validation_events (
  id uuid primary key default gen_random_uuid(), validation_id text not null references public.micro_utility_validations(public_id) on delete restrict,
  action text not null check (action in ('created','approve','confirm_live','retain','retire')), idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'), actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'), created_at timestamptz not null default now(), unique(validation_id,idempotency_hash)
);
alter table public.micro_utility_validations enable row level security; alter table public.micro_utility_validation_events enable row level security;
revoke all on table public.micro_utility_validations, public.micro_utility_validation_events from public, anon, authenticated;
grant select, insert, update on table public.micro_utility_validations to service_role; grant select, insert on table public.micro_utility_validation_events to service_role;
create or replace function public.create_micro_utility_validation(p_validation_id text,p_som_evaluation_id text,p_experiment_id text,p_utility text,p_target_price_cents integer,p_target_paid_orders integer,p_measure_days integer,p_idempotency_hash text,p_actor_fingerprint text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_evaluation public.som_evaluations%rowtype; v_experiment public.growth_experiments%rowtype; v_existing public.micro_utility_validations%rowtype; v_measure_after date;
begin
 if p_validation_id !~ '^microval_[a-f0-9]{32}$' or p_som_evaluation_id !~ '^som_[a-f0-9]{32}$' or p_experiment_id !~ '^experiment_[a-f0-9]{32}$' or p_utility <> 'receipts_to_csv' or p_target_price_cents not between 500 and 2000 or p_target_paid_orders not between 5 and 100 or p_measure_days not between 14 and 45 or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null then raise exception 'Invalid micro-utility validation.' using errcode='22023'; end if;
 select * into v_evaluation from public.som_evaluations where public_id=p_som_evaluation_id for update; if not found then raise exception 'SOM evaluation not found.' using errcode='P0002'; end if; if v_evaluation.decision='reject' then raise exception 'Rejected SOM evaluations cannot launch a validation.' using errcode='P0001'; end if;
 select * into v_experiment from public.growth_experiments where public_id=p_experiment_id for update; if not found then raise exception 'Growth experiment not found.' using errcode='P0002'; end if;
 select * into v_existing from public.micro_utility_validations where som_evaluation_id=p_som_evaluation_id and experiment_id=p_experiment_id and utility=p_utility for update; if found then return jsonb_build_object('validationId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
 v_measure_after := p_at::date + p_measure_days;
 insert into public.micro_utility_validations(public_id,som_evaluation_id,experiment_id,utility,target_price_cents,target_paid_orders,measure_after_on,status,created_at,updated_at) values(p_validation_id,p_som_evaluation_id,p_experiment_id,p_utility,p_target_price_cents,p_target_paid_orders,v_measure_after,'draft',p_at,p_at);
 insert into public.micro_utility_validation_events(validation_id,action,idempotency_hash,actor_fingerprint,created_at) values(p_validation_id,'created',p_idempotency_hash,p_actor_fingerprint,p_at);
 return jsonb_build_object('validationId',p_validation_id,'status','draft','launchPath','/utilities/receipts?exp=' || p_experiment_id,'measureAfterOn',v_measure_after,'idempotentReplay',false);
end; $$;
create or replace function public.operate_micro_utility_validation(p_validation_id text,p_action text,p_idempotency_hash text,p_actor_fingerprint text,p_at timestamptz) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_validation public.micro_utility_validations%rowtype; v_status text;
begin
 if p_validation_id !~ '^microval_[a-f0-9]{32}$' or p_action not in ('approve','confirm_live','retain','retire') or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null then raise exception 'Invalid micro-utility validation action.' using errcode='22023'; end if;
 select * into v_validation from public.micro_utility_validations where public_id=p_validation_id for update; if not found then raise exception 'Micro-utility validation not found.' using errcode='P0002'; end if;
 if exists(select 1 from public.micro_utility_validation_events where validation_id=p_validation_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('validationId',p_validation_id,'status',v_validation.status,'idempotentReplay',true); end if;
 v_status := case p_action when 'approve' then 'approved' when 'confirm_live' then 'measuring' when 'retain' then 'retained' else 'retired' end;
 if not ((p_action='approve' and v_validation.status='draft') or (p_action='confirm_live' and v_validation.status='approved') or (p_action in ('retain','retire') and v_validation.status='measuring')) then raise exception 'Operation is not allowed for the current validation state.' using errcode='P0001'; end if;
 insert into public.micro_utility_validation_events(validation_id,action,idempotency_hash,actor_fingerprint,created_at) values(p_validation_id,p_action,p_idempotency_hash,p_actor_fingerprint,p_at);
 update public.micro_utility_validations set status=v_status,updated_at=p_at where public_id=p_validation_id;
 return jsonb_build_object('validationId',p_validation_id,'status',v_status,'idempotentReplay',false);
end; $$;
revoke all on function public.create_micro_utility_validation(text,text,text,text,integer,integer,integer,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.operate_micro_utility_validation(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_micro_utility_validation(text,text,text,text,integer,integer,integer,text,text,timestamptz) to service_role;
grant execute on function public.operate_micro_utility_validation(text,text,text,text,timestamptz) to service_role;
