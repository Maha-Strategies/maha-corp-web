-- Opt-in Maha Navigator assessments. This stores a bounded, self-reported
-- operating inventory and consent record. It does not authorize outreach,
-- payments, contracts, or production access.

create table if not exists public.navigator_assessments (
  public_id text primary key check (public_id ~ '^nav_[a-f0-9]{32}$'),
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  requester_name text not null check (char_length(requester_name) between 2 and 120),
  requester_email text not null check (requester_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  requester_organization text not null check (char_length(requester_organization) between 2 and 160),
  requester_role text not null check (char_length(requester_role) between 2 and 120),
  deployment_stage text not null check (deployment_stage in ('exploring','pilot','production')),
  protocols text[] not null check (cardinality(protocols) between 1 and 5),
  priority text not null check (priority in ('tool_governance','payment_safety','context_cost','auditability','reliability')),
  primary_goal text not null check (char_length(primary_goal) between 20 and 1500),
  controls jsonb not null,
  assessment jsonb not null,
  readiness_score integer not null check (readiness_score between 0 and 100),
  readiness_band text not null check (readiness_band in ('foundational','developing','controlled')),
  pilot_candidate boolean not null,
  consent_version text not null default 'navigator-2026-08-09',
  consent_to_assessment boolean not null check (consent_to_assessment),
  consent_to_follow_up boolean not null,
  consented_at timestamptz not null,
  status text not null default 'submitted' check (status in ('submitted','under_review','pilot_candidate','introduced','closed')),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visitor_hash, idempotency_hash)
);

create table if not exists public.navigator_assessment_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id text not null references public.navigator_assessments(public_id) on delete restrict,
  action text not null check (action in ('submitted','start_review','mark_pilot_candidate','mark_introduced','close')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (assessment_id, idempotency_hash)
);

create index if not exists navigator_assessments_queue_idx on public.navigator_assessments (status, pilot_candidate desc, created_at asc);
alter table public.navigator_assessments enable row level security;
alter table public.navigator_assessment_events enable row level security;
revoke all on table public.navigator_assessments, public.navigator_assessment_events from public, anon, authenticated;
grant select, insert, update on table public.navigator_assessments to service_role;
grant select, insert on table public.navigator_assessment_events to service_role;

create or replace function public.operate_navigator_assessment(
  p_assessment_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.navigator_assessments%rowtype; v_status text;
begin
  if p_assessment_id !~ '^nav_[a-f0-9]{32}$' or p_action not in ('start_review','mark_pilot_candidate','mark_introduced','close') or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null or (p_note is not null and char_length(p_note) > 2000) then raise exception 'Invalid Navigator operation.' using errcode='22023'; end if;
  select * into v from public.navigator_assessments where public_id=p_assessment_id for update;
  if not found then raise exception 'Navigator assessment not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.navigator_assessment_events where assessment_id=p_assessment_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('assessmentId',p_assessment_id,'status',v.status,'idempotentReplay',true); end if;
  v_status:=case p_action when 'start_review' then 'under_review' when 'mark_pilot_candidate' then 'pilot_candidate' when 'mark_introduced' then 'introduced' else 'closed' end;
  if not ((p_action='start_review' and v.status='submitted') or (p_action='mark_pilot_candidate' and v.status='under_review' and v.consent_to_follow_up) or (p_action='mark_introduced' and v.status='pilot_candidate' and v.consent_to_follow_up) or (p_action='close' and v.status in ('submitted','under_review','pilot_candidate','introduced'))) then raise exception 'Operation is not allowed for the current Navigator state.' using errcode='P0001'; end if;
  insert into public.navigator_assessment_events (assessment_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_assessment_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.navigator_assessments set status=v_status,reviewer_note=nullif(p_note,''),reviewed_at=p_at,updated_at=p_at where public_id=p_assessment_id;
  return jsonb_build_object('assessmentId',p_assessment_id,'status',v_status,'idempotentReplay',false);
end; $$;

revoke all on function public.operate_navigator_assessment(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.operate_navigator_assessment(text,text,text,text,text,timestamptz) to service_role;
