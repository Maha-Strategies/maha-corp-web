-- Phase 2 source-completion workflow for frozen epistemic candidates.
-- Events coordinate work only. They cannot mutate an ingestion record, attach
-- expert approval, or cause a route to enter the public knowledge graph.

create table if not exists public.epistemic_source_completion_events (
  event_id text primary key check (event_id ~ '^epiwork_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-workflow/1.0'),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  target_sha256 text not null check (target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  action text not null check (action in ('triage','assign','start','submit-evidence','return','close')),
  previous_state text not null check (previous_state in ('untriaged','queued','assigned','in-progress','ready-for-reingestion','closed')),
  next_state text not null check (next_state in ('queued','assigned','in-progress','ready-for-reingestion','closed')),
  blocker_codes jsonb not null check (jsonb_typeof(blocker_codes) = 'array' and jsonb_array_length(blocker_codes) between 1 and 100),
  assignee_id text check (assignee_id is null or assignee_id ~ '^[a-z][a-z0-9_-]{7,63}$'),
  assignee_name text check (assignee_name is null or char_length(assignee_name) between 1 and 120),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 50),
  note text not null check (char_length(note) between 20 and 4000),
  event_sha256 text not null unique check (event_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  event_snapshot jsonb not null check (jsonb_typeof(event_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((assignee_id is null) = (assignee_name is null))
);

create index if not exists epistemic_source_completion_target_idx
  on public.epistemic_source_completion_events (candidate_record_id, target_sha256, occurred_at desc);
create index if not exists epistemic_source_completion_state_idx
  on public.epistemic_source_completion_events (next_state, occurred_at desc);

create trigger epistemic_source_completion_events_immutable
  before update or delete on public.epistemic_source_completion_events
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_source_completion_events enable row level security;
revoke all on table public.epistemic_source_completion_events from public, anon, authenticated;
grant select on table public.epistemic_source_completion_events to service_role;
revoke insert, update, delete, truncate on table public.epistemic_source_completion_events from service_role;

create or replace function public.record_epistemic_source_completion_event(
  p_event jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_source_completion_events%rowtype;
  v_target public.epistemic_ingestion_records%rowtype;
  v_latest public.epistemic_source_completion_events%rowtype;
  v_previous_state text := 'untriaged';
  v_expected_state text;
  v_action text := p_event->>'action';
  v_blocker text;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object'
    or coalesce(p_event->>'schemaVersion','') <> 'maha-epistemic-workflow/1.0'
    or coalesce(p_event->>'eventId','') !~ '^epiwork_[a-f0-9]{32}$'
    or coalesce(p_event->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_event->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_action,'') not in ('triage','assign','start','submit-evidence','return','close')
    or coalesce(p_event->>'previousState','') not in ('untriaged','queued','assigned','in-progress','ready-for-reingestion','closed')
    or coalesce(p_event->>'nextState','') not in ('queued','assigned','in-progress','ready-for-reingestion','closed')
    or jsonb_typeof(p_event->'blockerCodes') <> 'array'
    or jsonb_array_length(p_event->'blockerCodes') not between 1 and 100
    or jsonb_typeof(p_event->'evidence') <> 'array'
    or jsonb_array_length(p_event->'evidence') > 50
    or char_length(coalesce(p_event->>'note','')) not between 20 and 4000
    or coalesce(p_event->>'eventSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_event->>'occurredAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic source-completion event.' using errcode = '22023'; end if;

  if ((nullif(p_event->>'assigneeId','') is null) <> (nullif(p_event->>'assigneeName','') is null))
    or (nullif(p_event->>'assigneeId','') is not null and p_event->>'assigneeId' !~ '^[a-z][a-z0-9_-]{7,63}$')
  then raise exception 'Invalid source-completion assignee.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_source_completion_events where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('eventId', v_existing.event_id, 'state', v_existing.next_state, 'idempotentReplay', true); end if;

  select * into v_target from public.epistemic_ingestion_records
    where candidate_record_id = p_event->>'recordId' and review_target_sha256 = p_event->>'targetSha256'
    order by created_at desc limit 1;
  if not found then raise exception 'Frozen ingestion target not found.' using errcode = 'P0002'; end if;

  for v_blocker in select jsonb_array_elements_text(p_event->'blockerCodes') loop
    if not (coalesce(v_target.gate_decision->'reasons', '[]'::jsonb) ? v_blocker)
      or v_blocker like 'expert-review-%'
      or v_blocker in ('approval-review-missing','public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing')
    then raise exception 'Blocker is not a source-completion blocker on the frozen target.' using errcode = 'P0001'; end if;
  end loop;

  select * into v_latest from public.epistemic_source_completion_events
    where candidate_record_id = p_event->>'recordId' and target_sha256 = p_event->>'targetSha256'
    order by occurred_at desc, created_at desc limit 1;
  if found then v_previous_state := v_latest.next_state; end if;

  v_expected_state := case
    when v_previous_state = 'untriaged' and v_action = 'triage' then 'queued'
    when v_previous_state = 'queued' and v_action = 'assign' then 'assigned'
    when v_previous_state = 'queued' and v_action = 'start' then 'in-progress'
    when v_previous_state = 'assigned' and v_action = 'assign' then 'assigned'
    when v_previous_state = 'assigned' and v_action = 'start' then 'in-progress'
    when v_previous_state = 'assigned' and v_action = 'submit-evidence' then 'ready-for-reingestion'
    when v_previous_state = 'in-progress' and v_action = 'assign' then 'assigned'
    when v_previous_state = 'in-progress' and v_action = 'submit-evidence' then 'ready-for-reingestion'
    when v_previous_state = 'ready-for-reingestion' and v_action = 'return' then 'in-progress'
    when v_previous_state = 'ready-for-reingestion' and v_action = 'close' then 'closed'
    else null end;
  if v_expected_state is null
    or p_event->>'previousState' <> v_previous_state
    or p_event->>'nextState' <> v_expected_state
  then raise exception 'Source-completion state transition conflicts with the append-only ledger.' using errcode = 'P0001'; end if;

  if v_action in ('assign','start','submit-evidence') and nullif(p_event->>'assigneeId','') is null
  then raise exception 'This action requires an assignee.' using errcode = 'P0001'; end if;
  if v_action = 'submit-evidence' and jsonb_array_length(p_event->'evidence') < 1
  then raise exception 'Evidence is required before re-ingestion readiness.' using errcode = 'P0001'; end if;
  if v_action = 'submit-evidence' then
    for v_blocker in select jsonb_array_elements_text(p_event->'blockerCodes') loop
      if not exists (
        select 1 from jsonb_array_elements(p_event->'evidence') as item
        where item->>'blockerCode' = v_blocker
          and coalesce(item->>'sourceUrl','') ~ '^https://'
          and char_length(coalesce(item->>'note','')) between 20 and 2000
      ) then raise exception 'Every submitted blocker requires bounded evidence.' using errcode = 'P0001'; end if;
    end loop;
  end if;

  insert into public.epistemic_source_completion_events (
    event_id, schema_version, candidate_record_id, target_sha256, action,
    previous_state, next_state, blocker_codes, assignee_id, assignee_name,
    evidence, note, event_sha256, event_snapshot, actor_fingerprint,
    idempotency_hash, occurred_at, created_at
  ) values (
    p_event->>'eventId', p_event->>'schemaVersion', p_event->>'recordId', p_event->>'targetSha256', v_action,
    p_event->>'previousState', p_event->>'nextState', p_event->'blockerCodes', nullif(p_event->>'assigneeId',''), nullif(p_event->>'assigneeName',''),
    p_event->'evidence', p_event->>'note', p_event->>'eventSha256', p_event, p_actor_fingerprint,
    p_idempotency_hash, (p_event->>'occurredAt')::timestamptz, (p_event->>'occurredAt')::timestamptz
  );
  return jsonb_build_object('eventId', p_event->>'eventId', 'state', p_event->>'nextState', 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_source_completion_event(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_source_completion_event(jsonb,text,text) to service_role;

comment on table public.epistemic_source_completion_events is 'Append-only source-completion coordination bound to frozen epistemic targets. Queue state is not publication or expert approval.';

notify pgrst, 'reload schema';
