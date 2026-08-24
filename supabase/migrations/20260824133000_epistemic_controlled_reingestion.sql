-- Controlled Phase 2 re-ingestion. Evidence-bound corrections produce a new
-- immutable review target and an exact before/after ledger. No function in
-- this migration can request promotion or create public canonical content.

create table if not exists public.epistemic_reingestion_compilations (
  compilation_id text primary key check (compilation_id ~ '^epicomp_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-reingestion/1.0'),
  compiler_version text not null check (compiler_version = 'maha-controlled-reingestion-compiler/1.0'),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  domain_slug text not null check (domain_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  source_public_path text not null check (source_public_path ~ '^/knowledge/[a-z0-9/_-]+$'),
  base_candidate_sha256 text not null check (base_candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  base_target_sha256 text not null check (base_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  output_candidate_sha256 text not null check (output_candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  output_review_target_sha256 text not null check (output_review_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  correction_event_ids jsonb not null check (jsonb_typeof(correction_event_ids) = 'array' and jsonb_array_length(correction_event_ids) between 1 and 100),
  corrections jsonb not null check (jsonb_typeof(corrections) = 'array' and jsonb_array_length(corrections) between 1 and 100),
  diff jsonb not null check (jsonb_typeof(diff) = 'array' and jsonb_array_length(diff) between 1 and 100),
  resolved_blocker_codes jsonb not null check (jsonb_typeof(resolved_blocker_codes) = 'array' and jsonb_array_length(resolved_blocker_codes) between 1 and 100),
  gate_decision jsonb not null check (jsonb_typeof(gate_decision) = 'object'),
  public_eligible boolean not null check (public_eligible = false),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  compilation_sha256 text not null unique check (compilation_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  compilation_snapshot jsonb not null check (jsonb_typeof(compilation_snapshot) = 'object'),
  note text not null check (char_length(note) between 20 and 4000),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  compiled_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (base_target_sha256 <> output_review_target_sha256),
  unique (candidate_record_id, output_review_target_sha256)
);

create index if not exists epistemic_reingestion_record_idx
  on public.epistemic_reingestion_compilations (candidate_record_id, compiled_at desc);
create index if not exists epistemic_reingestion_base_target_idx
  on public.epistemic_reingestion_compilations (base_target_sha256, compiled_at desc);

create trigger epistemic_reingestion_compilations_immutable
  before update or delete on public.epistemic_reingestion_compilations
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_reingestion_compilations enable row level security;
revoke all on table public.epistemic_reingestion_compilations from public, anon, authenticated;
grant select on table public.epistemic_reingestion_compilations to service_role;
revoke insert, update, delete, truncate on table public.epistemic_reingestion_compilations from service_role;

create or replace function public.record_epistemic_reingestion_compilation(
  p_compilation jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_reingestion_compilations%rowtype;
  v_base_gate jsonb;
  v_base_snapshot jsonb;
  v_base_candidate_sha256 text;
  v_base_source_public_path text;
  v_current_target_sha256 text;
  v_correction jsonb;
  v_event public.epistemic_source_completion_events%rowtype;
  v_latest_work public.epistemic_source_completion_events%rowtype;
  v_blocker text;
  v_event_id text;
  v_entity_id text;
  v_proposed_value text;
begin
  if p_compilation is null or jsonb_typeof(p_compilation) <> 'object'
    or coalesce(p_compilation->>'schemaVersion','') <> 'maha-epistemic-reingestion/1.0'
    or coalesce(p_compilation->>'compilerVersion','') <> 'maha-controlled-reingestion-compiler/1.0'
    or coalesce(p_compilation->>'compilationId','') !~ '^epicomp_[a-f0-9]{32}$'
    or coalesce(p_compilation->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_compilation->>'domainSlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_compilation->>'sourcePublicPath','') !~ '^/knowledge/[a-z0-9/_-]+$'
    or coalesce(p_compilation->>'baseCandidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_compilation->>'baseTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_compilation->>'outputCandidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_compilation->>'outputReviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or p_compilation->>'baseTargetSha256' = p_compilation->>'outputReviewTargetSha256'
    or jsonb_typeof(p_compilation->'correctionEventIds') <> 'array'
    or jsonb_array_length(p_compilation->'correctionEventIds') not between 1 and 100
    or jsonb_typeof(p_compilation->'corrections') <> 'array'
    or jsonb_array_length(p_compilation->'corrections') not between 1 and 100
    or jsonb_typeof(p_compilation->'diff') <> 'array'
    or jsonb_array_length(p_compilation->'diff') <> jsonb_array_length(p_compilation->'corrections')
    or jsonb_typeof(p_compilation->'resolvedBlockerCodes') <> 'array'
    or jsonb_array_length(p_compilation->'resolvedBlockerCodes') <> jsonb_array_length(p_compilation->'corrections')
    or jsonb_typeof(p_compilation->'gateDecision') <> 'object'
    or coalesce(p_compilation#>>'{gateDecision,publicEligible}','true') <> 'false'
    or jsonb_typeof(p_compilation->'outputRecord') <> 'object'
    or coalesce(p_compilation#>>'{outputRecord,id}','') <> p_compilation->>'recordId'
    or coalesce(p_compilation#>>'{outputRecord,domainSlug}','') <> p_compilation->>'domainSlug'
    or coalesce(p_compilation#>>'{outputRecord,publication,requestedPublicPromotion}','true') <> 'false'
    or coalesce(p_compilation#>>'{outputRecord,publication,reviewState}','') <> 'draft'
    or p_compilation#>'{outputRecord,publication,publishedAt}' is not null
    or jsonb_typeof(p_compilation#>'{outputRecord,publication,reviewEvents}') <> 'array'
    or jsonb_array_length(p_compilation#>'{outputRecord,publication,reviewEvents}') <> 0
    or char_length(coalesce(p_compilation->>'note','')) not between 20 and 4000
    or coalesce(p_compilation->>'compiledAt','') !~ 'Z$'
    or coalesce(p_compilation->>'compilationSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic re-ingestion compilation.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_reingestion_compilations where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('compilationId', v_existing.compilation_id, 'outputReviewTargetSha256', v_existing.output_review_target_sha256, 'idempotentReplay', true); end if;

  select target.gate_decision, target.record_snapshot, target.candidate_sha256, target.source_public_path
    into v_base_gate, v_base_snapshot, v_base_candidate_sha256, v_base_source_public_path from (
    select gate_decision, record_snapshot->'candidateSnapshot' as record_snapshot, candidate_sha256, source_public_path, created_at as target_at
      from public.epistemic_ingestion_records
      where candidate_record_id = p_compilation->>'recordId' and review_target_sha256 = p_compilation->>'baseTargetSha256'
    union all
    select gate_decision, record_snapshot, output_candidate_sha256 as candidate_sha256, source_public_path, compiled_at as target_at
      from public.epistemic_reingestion_compilations
      where candidate_record_id = p_compilation->>'recordId' and output_review_target_sha256 = p_compilation->>'baseTargetSha256'
  ) as target order by target.target_at desc limit 1;
  if v_base_snapshot is null then raise exception 'Frozen re-ingestion base target not found.' using errcode = 'P0002'; end if;
  if coalesce(v_base_snapshot->>'domainSlug','') <> p_compilation->>'domainSlug'
  then raise exception 'Compilation domain does not match the frozen base target.' using errcode = 'P0001'; end if;
  if v_base_candidate_sha256 <> p_compilation->>'baseCandidateSha256' or v_base_source_public_path <> p_compilation->>'sourcePublicPath'
  then raise exception 'Compilation lineage does not match the frozen base target.' using errcode = 'P0001'; end if;

  select target.target_sha256 into v_current_target_sha256 from (
    select review_target_sha256 as target_sha256, created_at as target_at from public.epistemic_ingestion_records
      where candidate_record_id = p_compilation->>'recordId'
    union all
    select output_review_target_sha256 as target_sha256, compiled_at as target_at from public.epistemic_reingestion_compilations
      where candidate_record_id = p_compilation->>'recordId'
  ) as target order by target.target_at desc limit 1;
  if v_current_target_sha256 <> p_compilation->>'baseTargetSha256'
  then raise exception 'Controlled re-ingestion cannot fork a superseded target.' using errcode = 'P0001'; end if;

  select * into v_latest_work from public.epistemic_source_completion_events
    where candidate_record_id = p_compilation->>'recordId' and target_sha256 = p_compilation->>'baseTargetSha256'
    order by occurred_at desc, created_at desc limit 1;
  if not found or v_latest_work.next_state <> 'ready-for-reingestion'
  then raise exception 'The frozen target is no longer ready for controlled re-ingestion.' using errcode = 'P0001'; end if;

  for v_correction in select value from jsonb_array_elements(p_compilation->'corrections') loop
    v_blocker := v_correction->>'blockerCode';
    v_event_id := v_correction->>'evidenceEventId';
    v_proposed_value := v_correction->>'proposedValue';
    if coalesce(v_blocker,'') = '' or coalesce(v_event_id,'') !~ '^epiwork_[a-f0-9]{32}$'
      or char_length(coalesce(v_proposed_value,'')) not between 1 and 4000
      or not (coalesce(v_base_gate->'reasons','[]'::jsonb) ? v_blocker)
      or not (p_compilation->'resolvedBlockerCodes' ? v_blocker)
      or coalesce(p_compilation->'gateDecision'->'reasons','[]'::jsonb) ? v_blocker
    then raise exception 'Correction is not bound to a resolved blocker on the frozen target.' using errcode = 'P0001'; end if;

    select * into v_event from public.epistemic_source_completion_events
      where event_id = v_event_id
        and candidate_record_id = p_compilation->>'recordId'
        and target_sha256 = p_compilation->>'baseTargetSha256'
        and action = 'submit-evidence'
      limit 1;
    if not found
      or v_event.event_sha256 <> v_correction->>'evidenceEventSha256'
      or not exists (select 1 from jsonb_array_elements(v_event.evidence) item where item->>'blockerCode' = v_blocker)
    then raise exception 'Correction evidence does not match the frozen source-completion ledger.' using errcode = 'P0001'; end if;

    if v_blocker like 'source-locator-missing:%' then
      v_entity_id := substr(v_blocker, char_length('source-locator-missing:') + 1);
      if not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') item where item->>'id' = v_entity_id and item->>'exactLocator' = v_proposed_value)
      then raise exception 'Compiled source locator does not match the correction.' using errcode = 'P0001'; end if;
    elsif v_blocker like 'source-publication-date-missing:%' then
      v_entity_id := substr(v_blocker, char_length('source-publication-date-missing:') + 1);
      if v_proposed_value !~ '^\d{4}-\d{2}-\d{2}$'
        or not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,sources}') item where item->>'id' = v_entity_id and item->>'publishedAt' = v_proposed_value)
      then raise exception 'Compiled source publication date does not match the correction.' using errcode = 'P0001'; end if;
    elsif v_blocker like 'claim-evidence-not-assessed:%' then
      v_entity_id := substr(v_blocker, char_length('claim-evidence-not-assessed:') + 1);
      if v_proposed_value not in ('not-applicable','single-study','multi-study','independently-replicated','contested','historical-attestation','formally-verified')
        or not exists (select 1 from jsonb_array_elements(p_compilation#>'{outputRecord,claims}') item where item->>'id' = v_entity_id and item->>'evidenceMaturity' = v_proposed_value)
      then raise exception 'Compiled claim evidence maturity does not match the correction.' using errcode = 'P0001'; end if;
    else
      raise exception 'Correction type is not supported by the controlled compiler.' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.epistemic_reingestion_compilations (
    compilation_id, schema_version, compiler_version, candidate_record_id, domain_slug,
    source_public_path, base_candidate_sha256, base_target_sha256, output_candidate_sha256,
    output_review_target_sha256, correction_event_ids, corrections, diff,
    resolved_blocker_codes, gate_decision, public_eligible, record_snapshot,
    compilation_sha256, compilation_snapshot, note, actor_fingerprint,
    idempotency_hash, compiled_at, created_at
  ) values (
    p_compilation->>'compilationId', p_compilation->>'schemaVersion', p_compilation->>'compilerVersion', p_compilation->>'recordId', p_compilation->>'domainSlug',
    p_compilation->>'sourcePublicPath', p_compilation->>'baseCandidateSha256', p_compilation->>'baseTargetSha256', p_compilation->>'outputCandidateSha256',
    p_compilation->>'outputReviewTargetSha256', p_compilation->'correctionEventIds', p_compilation->'corrections', p_compilation->'diff',
    p_compilation->'resolvedBlockerCodes', p_compilation->'gateDecision', false, p_compilation->'outputRecord',
    p_compilation->>'compilationSha256', p_compilation, p_compilation->>'note', p_actor_fingerprint,
    p_idempotency_hash, (p_compilation->>'compiledAt')::timestamptz, (p_compilation->>'compiledAt')::timestamptz
  );
  return jsonb_build_object('compilationId', p_compilation->>'compilationId', 'outputReviewTargetSha256', p_compilation->>'outputReviewTargetSha256', 'idempotentReplay', false);
end; $$;

-- Expert reviews may now target either an original ingestion snapshot or a
-- compiler-created revision. The review remains bound to one exact digest.
create or replace function public.record_epistemic_expert_review(
  p_review jsonb,
  p_profile_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_expert_review_decisions%rowtype;
  v_prior public.epistemic_expert_review_decisions%rowtype;
  v_profile public.epistemic_expert_reviewer_profiles%rowtype;
  v_target_domain text;
  v_reviewer jsonb := p_review->'reviewer';
  v_reviewer_id text := v_reviewer->>'reviewerId';
  v_profile_version integer;
begin
  if p_review is null or jsonb_typeof(p_review) <> 'object'
    or coalesce(p_review->>'schemaVersion','') <> 'maha-epistemic-review/1.0'
    or coalesce(p_review->>'reviewId','') !~ '^epireview_[a-f0-9]{32}$'
    or coalesce(p_review->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_review->>'domainSlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_review->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_review->>'scope','') not in ('source-fidelity','domain-fidelity','boundary-adequacy','rights-and-locator')
    or coalesce(p_review->>'decision','') not in ('approve','approve-with-reservations','request-changes','abstain')
    or jsonb_typeof(p_review->'criteria') <> 'array' or jsonb_array_length(p_review->'criteria') <> 3
    or jsonb_typeof(p_review->'disagreements') <> 'array' or jsonb_array_length(p_review->'disagreements') > 20
    or char_length(coalesce(p_review->>'rationale','')) not between 20 and 4000
    or coalesce(p_review->>'reviewSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_review->>'reviewedAt','') !~ 'Z$'
    or coalesce(v_reviewer_id,'') !~ '^expert_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(v_reviewer->>'profileVersion','') !~ '^[1-9][0-9]*$'
    or jsonb_typeof(v_reviewer->'qualifications') <> 'array' or jsonb_array_length(v_reviewer->'qualifications') < 1
    or jsonb_typeof(v_reviewer->'domains') <> 'array' or not (v_reviewer->'domains' ? (p_review->>'domainSlug'))
    or p_profile_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic expert review.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_expert_review_decisions where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('reviewId', v_existing.review_id, 'decision', v_existing.decision, 'idempotentReplay', true); end if;

  select target.domain_slug into v_target_domain from (
    select record_snapshot#>>'{candidateSnapshot,domainSlug}' as domain_slug, created_at as target_at
      from public.epistemic_ingestion_records where candidate_record_id = p_review->>'recordId' and review_target_sha256 = p_review->>'targetSha256'
    union all
    select domain_slug, compiled_at as target_at
      from public.epistemic_reingestion_compilations where candidate_record_id = p_review->>'recordId' and output_review_target_sha256 = p_review->>'targetSha256'
  ) as target order by target.target_at desc limit 1;
  if v_target_domain is null then raise exception 'Frozen review target not found.' using errcode = 'P0002'; end if;
  if v_target_domain <> p_review->>'domainSlug' then raise exception 'Review domain does not match the frozen target.' using errcode = 'P0001'; end if;

  v_profile_version := (v_reviewer->>'profileVersion')::integer;
  insert into public.epistemic_expert_reviewer_profiles (reviewer_id, profile_version, profile_sha256, profile_snapshot, created_at)
  values (v_reviewer_id, v_profile_version, p_profile_sha256, v_reviewer, (p_review->>'reviewedAt')::timestamptz)
  on conflict (reviewer_id, profile_version) do nothing;
  select * into v_profile from public.epistemic_expert_reviewer_profiles where reviewer_id = v_reviewer_id and profile_version = v_profile_version;
  if v_profile.profile_sha256 <> p_profile_sha256 or v_profile.profile_snapshot <> v_reviewer
  then raise exception 'Reviewer profile version already exists with different identity data.' using errcode = 'P0001'; end if;

  if nullif(p_review->>'supersedesReviewId','') is not null then
    select * into v_prior from public.epistemic_expert_review_decisions where review_id = p_review->>'supersedesReviewId';
    if not found then raise exception 'Superseded review not found.' using errcode = 'P0002'; end if;
    if v_prior.candidate_record_id <> p_review->>'recordId' or v_prior.target_sha256 <> p_review->>'targetSha256'
      or v_prior.review_scope <> p_review->>'scope' or v_prior.reviewer_id <> v_reviewer_id
    then raise exception 'A review can supersede only the same reviewer, scope, and frozen target.' using errcode = 'P0001'; end if;
  end if;

  insert into public.epistemic_expert_review_decisions (
    review_id, schema_version, candidate_record_id, domain_slug, target_sha256, review_scope,
    reviewer_id, reviewer_profile_version, decision, criteria, disagreements, rationale,
    supersedes_review_id, review_sha256, review_snapshot, actor_fingerprint,
    idempotency_hash, reviewed_at, created_at
  ) values (
    p_review->>'reviewId', p_review->>'schemaVersion', p_review->>'recordId', p_review->>'domainSlug', p_review->>'targetSha256', p_review->>'scope',
    v_reviewer_id, v_profile_version, p_review->>'decision', p_review->'criteria', p_review->'disagreements', p_review->>'rationale',
    nullif(p_review->>'supersedesReviewId',''), p_review->>'reviewSha256', p_review, p_actor_fingerprint,
    p_idempotency_hash, (p_review->>'reviewedAt')::timestamptz, (p_review->>'reviewedAt')::timestamptz
  );
  return jsonb_build_object('reviewId', p_review->>'reviewId', 'decision', p_review->>'decision', 'idempotentReplay', false);
end; $$;

-- Source work can continue against a compiled target when blockers remain.
create or replace function public.record_epistemic_source_completion_event(
  p_event jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_source_completion_events%rowtype;
  v_latest public.epistemic_source_completion_events%rowtype;
  v_target_gate jsonb;
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
    or jsonb_typeof(p_event->'blockerCodes') <> 'array' or jsonb_array_length(p_event->'blockerCodes') not between 1 and 100
    or jsonb_typeof(p_event->'evidence') <> 'array' or jsonb_array_length(p_event->'evidence') > 50
    or char_length(coalesce(p_event->>'note','')) not between 20 and 4000
    or coalesce(p_event->>'eventSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_event->>'occurredAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic source-completion event.' using errcode = '22023'; end if;

  if ((nullif(p_event->>'assigneeId','') is null) <> (nullif(p_event->>'assigneeName','') is null))
    or (nullif(p_event->>'assigneeId','') is not null and p_event->>'assigneeId' !~ '^[a-z][a-z0-9_-]{7,63}$')
  then raise exception 'Invalid source-completion assignee.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_source_completion_events where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('eventId', v_existing.event_id, 'state', v_existing.next_state, 'idempotentReplay', true); end if;

  select target.gate_decision into v_target_gate from (
    select gate_decision, created_at as target_at from public.epistemic_ingestion_records
      where candidate_record_id = p_event->>'recordId' and review_target_sha256 = p_event->>'targetSha256'
    union all
    select gate_decision, compiled_at as target_at from public.epistemic_reingestion_compilations
      where candidate_record_id = p_event->>'recordId' and output_review_target_sha256 = p_event->>'targetSha256'
  ) as target order by target.target_at desc limit 1;
  if v_target_gate is null then raise exception 'Frozen source-completion target not found.' using errcode = 'P0002'; end if;

  for v_blocker in select jsonb_array_elements_text(p_event->'blockerCodes') loop
    if not (coalesce(v_target_gate->'reasons', '[]'::jsonb) ? v_blocker)
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
  if v_expected_state is null or p_event->>'previousState' <> v_previous_state or p_event->>'nextState' <> v_expected_state
  then raise exception 'Source-completion state transition conflicts with the append-only ledger.' using errcode = 'P0001'; end if;

  if v_action in ('assign','start','submit-evidence') and nullif(p_event->>'assigneeId','') is null
  then raise exception 'This action requires an assignee.' using errcode = 'P0001'; end if;
  if v_action = 'submit-evidence' and jsonb_array_length(p_event->'evidence') < 1
  then raise exception 'Evidence is required before re-ingestion readiness.' using errcode = 'P0001'; end if;
  if v_action = 'submit-evidence' then
    for v_blocker in select jsonb_array_elements_text(p_event->'blockerCodes') loop
      if not exists (
        select 1 from jsonb_array_elements(p_event->'evidence') as item
        where item->>'blockerCode' = v_blocker and coalesce(item->>'sourceUrl','') ~ '^https://'
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

revoke all on function public.record_epistemic_reingestion_compilation(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.record_epistemic_expert_review(jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.record_epistemic_source_completion_event(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_reingestion_compilation(jsonb,text,text) to service_role;
grant execute on function public.record_epistemic_expert_review(jsonb,text,text,text) to service_role;
grant execute on function public.record_epistemic_source_completion_event(jsonb,text,text) to service_role;

comment on table public.epistemic_reingestion_compilations is 'Append-only, evidence-bound controlled revisions. Every output is reset to draft and requires fresh expert review; no row is a publication approval.';

notify pgrst, 'reload schema';
