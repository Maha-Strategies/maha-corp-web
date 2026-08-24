-- Phase 3: a separately authorized, append-only canonical release ledger.
-- Expert approval and release authority remain distinct. No ingestion or
-- re-ingestion credential can call either RPC.

create table if not exists public.epistemic_canonical_releases (
  release_id text primary key check (release_id ~ '^epirelease_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-release/1.0'),
  release_kind text not null check (release_kind in ('initial','superseding')),
  candidate_record_id text not null,
  domain_slug text not null,
  target_sha256 text not null check (target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  canonical_path text not null check (canonical_path ~ '^/knowledge/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$'),
  canonical_version text not null,
  supersedes_release_id text references public.epistemic_canonical_releases(release_id),
  approvals jsonb not null check (jsonb_typeof(approvals) = 'array' and jsonb_array_length(approvals) > 0),
  authority_id text not null,
  authority_sha256 text not null check (authority_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  authority_snapshot jsonb not null check (jsonb_typeof(authority_snapshot) = 'object'),
  public_change_summary text not null,
  rationale text not null,
  record_sha256 text not null check (record_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  gate_decision jsonb not null check (jsonb_typeof(gate_decision) = 'object'),
  release_sha256 text not null unique check (release_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  release_snapshot jsonb not null check (jsonb_typeof(release_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  released_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (candidate_record_id, canonical_version)
);

create table if not exists public.epistemic_release_withdrawals (
  withdrawal_id text primary key check (withdrawal_id ~ '^epiwithdraw_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-withdrawal/1.0'),
  release_id text not null unique references public.epistemic_canonical_releases(release_id),
  candidate_record_id text not null,
  canonical_path text not null,
  authority_id text not null,
  authority_sha256 text not null check (authority_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  authority_snapshot jsonb not null check (jsonb_typeof(authority_snapshot) = 'object'),
  public_change_summary text not null,
  rationale text not null,
  withdrawal_sha256 text not null unique check (withdrawal_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  withdrawal_snapshot jsonb not null check (jsonb_typeof(withdrawal_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  withdrawn_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists epistemic_canonical_release_record_idx
  on public.epistemic_canonical_releases (candidate_record_id, released_at desc);
create index if not exists epistemic_canonical_release_path_idx
  on public.epistemic_canonical_releases (canonical_path, released_at desc);

create trigger epistemic_canonical_releases_immutable
  before update or delete on public.epistemic_canonical_releases
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_release_withdrawals_immutable
  before update or delete on public.epistemic_release_withdrawals
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_canonical_releases enable row level security;
alter table public.epistemic_release_withdrawals enable row level security;
revoke all on table public.epistemic_canonical_releases from public, anon, authenticated;
revoke all on table public.epistemic_release_withdrawals from public, anon, authenticated;
grant select on table public.epistemic_canonical_releases to service_role;
grant select on table public.epistemic_release_withdrawals to service_role;
revoke insert, update, delete, truncate on table public.epistemic_canonical_releases from service_role;
revoke insert, update, delete, truncate on table public.epistemic_release_withdrawals from service_role;

create or replace function public.record_epistemic_canonical_release(
  p_release jsonb,
  p_authority_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_canonical_releases%rowtype;
  v_active public.epistemic_canonical_releases%rowtype;
  v_target_record jsonb;
  v_target_gate jsonb;
  v_current_target_sha256 text;
  v_expected_path text;
  v_scope text;
  v_scope_count integer := 0;
  v_review public.epistemic_expert_review_decisions%rowtype;
  v_reason text;
begin
  if p_release is null or jsonb_typeof(p_release) <> 'object'
    or coalesce(p_release->>'schemaVersion','') <> 'maha-epistemic-release/1.0'
    or coalesce(p_release->>'releaseId','') !~ '^epirelease_[a-f0-9]{32}$'
    or coalesce(p_release->>'releaseKind','') not in ('initial','superseding')
    or coalesce(p_release->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_release->>'domainSlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_release->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_release->>'canonicalVersion','') !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
    or jsonb_typeof(p_release->'approvals') <> 'array' or jsonb_array_length(p_release->'approvals') < 1
    or jsonb_typeof(p_release->'authority') <> 'object'
    or coalesce(p_release#>>'{authority,authorityId}','') !~ '^authority_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(p_release->>'authoritySha256','') <> p_authority_sha256
    or p_authority_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_release->>'publicChangeSummary','')) not between 20 and 500
    or char_length(coalesce(p_release->>'rationale','')) not between 40 and 4000
    or coalesce(p_release->>'recordSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or jsonb_typeof(p_release->'recordSnapshot') <> 'object'
    or coalesce(p_release#>>'{gateDecision,publicEligible}','false') <> 'true'
    or jsonb_typeof(p_release#>'{gateDecision,reasons}') <> 'array'
    or jsonb_array_length(p_release#>'{gateDecision,reasons}') <> 0
    or coalesce(p_release->>'releaseSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_release->>'releasedAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic canonical release.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_canonical_releases where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('releaseId', v_existing.release_id, 'canonicalPath', v_existing.canonical_path, 'idempotentReplay', true); end if;

  select target.record_snapshot, target.gate_decision, target.target_sha256
    into v_target_record, v_target_gate, v_current_target_sha256
  from (
    select record_snapshot->'candidateSnapshot' as record_snapshot, gate_decision, review_target_sha256 as target_sha256, created_at as target_at
      from public.epistemic_ingestion_records where candidate_record_id = p_release->>'recordId'
    union all
    select record_snapshot, gate_decision, output_review_target_sha256 as target_sha256, compiled_at as target_at
      from public.epistemic_reingestion_compilations where candidate_record_id = p_release->>'recordId'
  ) target order by target.target_at desc limit 1;
  if v_target_record is null then raise exception 'Frozen release target not found.' using errcode = 'P0002'; end if;
  if v_current_target_sha256 <> p_release->>'targetSha256'
  then raise exception 'Canonical release must bind the latest frozen target.' using errcode = 'P0001'; end if;
  if v_target_record - 'publication' <> (p_release->'recordSnapshot') - 'publication'
  then raise exception 'Released content differs from the frozen review target.' using errcode = 'P0001'; end if;
  if v_target_record->>'id' <> p_release->>'recordId' or v_target_record->>'domainSlug' <> p_release->>'domainSlug'
  then raise exception 'Released identity differs from the frozen review target.' using errcode = 'P0001'; end if;

  for v_reason in select jsonb_array_elements_text(coalesce(v_target_gate->'reasons','[]'::jsonb)) loop
    if v_reason not in ('public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing','approval-review-missing')
      and v_reason not like 'expert-review-%'
    then raise exception 'The frozen target retains a non-release blocker: %', v_reason using errcode = 'P0001'; end if;
  end loop;

  v_expected_path := format('/knowledge/%s/%s/%s',
    v_target_record->>'domainSlug',
    case when v_target_record->>'recordKind' = 'hypothesis' then 'hypotheses' else (v_target_record->>'recordKind') || 's' end,
    v_target_record->>'slug');
  if p_release->>'canonicalPath' <> v_expected_path
    or p_release#>>'{recordSnapshot,publication,requestedPublicPromotion}' <> 'true'
    or p_release#>>'{recordSnapshot,publication,reviewState}' <> 'published-canonical'
    or p_release#>>'{recordSnapshot,publication,canonicalVersion}' <> p_release->>'canonicalVersion'
    or coalesce(p_release#>>'{recordSnapshot,publication,publishedAt}','') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'Canonical publication controls or path are invalid.' using errcode = 'P0001'; end if;

  for v_scope in select jsonb_array_elements_text(coalesce(v_target_record#>'{publication,requiredReviewScopes}','[]'::jsonb)) loop
    v_scope_count := v_scope_count + 1;
    select * into v_review from public.epistemic_expert_review_decisions
      where candidate_record_id = p_release->>'recordId'
        and target_sha256 = p_release->>'targetSha256'
        and review_scope = v_scope
      order by reviewed_at desc, created_at desc limit 1;
    if not found or v_review.decision <> 'approve'
    then raise exception 'Required scope % lacks an exact unqualified approval.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release->'approvals') approval
      where approval->>'scope' = v_scope and approval->>'reviewId' = v_review.review_id
        and approval->>'reviewSha256' = v_review.review_sha256
    ) then raise exception 'Release approval manifest does not match the latest % review.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release#>'{recordSnapshot,publication,reviewEvents}') event
      where event->>'scope' = v_scope and event->>'reviewId' = v_review.review_id
        and event->>'targetSha256' = p_release->>'targetSha256' and event->>'verdict' = 'approve'
    ) then raise exception 'Canonical record does not embed the exact % approval.', v_scope using errcode = 'P0001'; end if;
  end loop;
  if v_scope_count < 1 or jsonb_array_length(p_release->'approvals') <> v_scope_count
  then raise exception 'Release approval manifest must contain every required scope exactly once.' using errcode = 'P0001'; end if;

  select release.* into v_active from public.epistemic_canonical_releases release
    where release.candidate_record_id = p_release->>'recordId'
      and not exists (select 1 from public.epistemic_canonical_releases child where child.supersedes_release_id = release.release_id)
      and not exists (select 1 from public.epistemic_release_withdrawals withdrawal where withdrawal.release_id = release.release_id)
    order by release.released_at desc limit 1;
  if found then
    if p_release->>'releaseKind' <> 'superseding' or p_release->>'supersedesReleaseId' <> v_active.release_id
      or p_release->>'targetSha256' = v_active.target_sha256
    then raise exception 'A new canonical version must explicitly supersede the active release with a new target.' using errcode = 'P0001'; end if;
  elsif p_release->>'releaseKind' <> 'initial' or nullif(p_release->>'supersedesReleaseId','') is not null then
    raise exception 'An initial release cannot declare a superseded release.' using errcode = 'P0001';
  end if;

  insert into public.epistemic_canonical_releases (
    release_id, schema_version, release_kind, candidate_record_id, domain_slug,
    target_sha256, canonical_path, canonical_version, supersedes_release_id,
    approvals, authority_id, authority_sha256, authority_snapshot, public_change_summary, rationale,
    record_sha256, record_snapshot, gate_decision, release_sha256, release_snapshot,
    actor_fingerprint, idempotency_hash, released_at, created_at
  ) values (
    p_release->>'releaseId', p_release->>'schemaVersion', p_release->>'releaseKind', p_release->>'recordId', p_release->>'domainSlug',
    p_release->>'targetSha256', p_release->>'canonicalPath', p_release->>'canonicalVersion', nullif(p_release->>'supersedesReleaseId',''),
    p_release->'approvals', p_release#>>'{authority,authorityId}', p_authority_sha256, p_release->'authority', p_release->>'publicChangeSummary', p_release->>'rationale',
    p_release->>'recordSha256', p_release->'recordSnapshot', p_release->'gateDecision', p_release->>'releaseSha256', p_release,
    p_actor_fingerprint, p_idempotency_hash, (p_release->>'releasedAt')::timestamptz, (p_release->>'releasedAt')::timestamptz
  );
  return jsonb_build_object('releaseId', p_release->>'releaseId', 'canonicalPath', p_release->>'canonicalPath', 'idempotentReplay', false);
end; $$;

create or replace function public.record_epistemic_release_withdrawal(
  p_withdrawal jsonb,
  p_authority_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_release_withdrawals%rowtype;
  v_release public.epistemic_canonical_releases%rowtype;
begin
  if p_withdrawal is null or jsonb_typeof(p_withdrawal) <> 'object'
    or coalesce(p_withdrawal->>'schemaVersion','') <> 'maha-epistemic-withdrawal/1.0'
    or coalesce(p_withdrawal->>'withdrawalId','') !~ '^epiwithdraw_[a-f0-9]{32}$'
    or coalesce(p_withdrawal->>'releaseId','') !~ '^epirelease_[a-f0-9]{32}$'
    or coalesce(p_withdrawal->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or jsonb_typeof(p_withdrawal->'authority') <> 'object'
    or coalesce(p_withdrawal#>>'{authority,authorityId}','') !~ '^authority_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(p_withdrawal->>'authoritySha256','') <> p_authority_sha256
    or p_authority_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_withdrawal->>'publicChangeSummary','')) not between 20 and 500
    or char_length(coalesce(p_withdrawal->>'rationale','')) not between 40 and 4000
    or coalesce(p_withdrawal->>'withdrawalSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_withdrawal->>'withdrawnAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic release withdrawal.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_release_withdrawals where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('withdrawalId', v_existing.withdrawal_id, 'releaseId', v_existing.release_id, 'idempotentReplay', true); end if;

  select * into v_release from public.epistemic_canonical_releases where release_id = p_withdrawal->>'releaseId';
  if not found then raise exception 'Canonical release not found.' using errcode = 'P0002'; end if;
  if v_release.candidate_record_id <> p_withdrawal->>'recordId' or v_release.canonical_path <> p_withdrawal->>'canonicalPath'
  then raise exception 'Withdrawal identity does not match the canonical release.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.epistemic_canonical_releases child where child.supersedes_release_id = v_release.release_id)
    or exists (select 1 from public.epistemic_release_withdrawals prior where prior.release_id = v_release.release_id)
  then raise exception 'Only the active, non-withdrawn canonical release may be withdrawn.' using errcode = 'P0001'; end if;

  insert into public.epistemic_release_withdrawals (
    withdrawal_id, schema_version, release_id, candidate_record_id, canonical_path,
    authority_id, authority_sha256, authority_snapshot, public_change_summary, rationale,
    withdrawal_sha256, withdrawal_snapshot, actor_fingerprint, idempotency_hash,
    withdrawn_at, created_at
  ) values (
    p_withdrawal->>'withdrawalId', p_withdrawal->>'schemaVersion', p_withdrawal->>'releaseId', p_withdrawal->>'recordId', p_withdrawal->>'canonicalPath',
    p_withdrawal#>>'{authority,authorityId}', p_authority_sha256, p_withdrawal->'authority', p_withdrawal->>'publicChangeSummary', p_withdrawal->>'rationale',
    p_withdrawal->>'withdrawalSha256', p_withdrawal, p_actor_fingerprint, p_idempotency_hash,
    (p_withdrawal->>'withdrawnAt')::timestamptz, (p_withdrawal->>'withdrawnAt')::timestamptz
  );
  return jsonb_build_object('withdrawalId', p_withdrawal->>'withdrawalId', 'releaseId', p_withdrawal->>'releaseId', 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_canonical_release(jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.record_epistemic_release_withdrawal(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_canonical_release(jsonb,text,text,text) to service_role;
grant execute on function public.record_epistemic_release_withdrawal(jsonb,text,text,text) to service_role;

comment on table public.epistemic_canonical_releases is 'Immutable exact-hash canonical releases authorized separately from ingestion and expert review. Release authority is a publication decision, not scientific validation.';
comment on table public.epistemic_release_withdrawals is 'Immutable public correction history. Withdrawal removes a release from the active projection without deleting its provenance.';

notify pgrst, 'reload schema';
