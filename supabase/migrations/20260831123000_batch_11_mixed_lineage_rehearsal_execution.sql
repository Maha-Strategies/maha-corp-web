-- Batch 11 mixed-lineage Preview rehearsal execution.
--
-- Applied only to a disposable schema-only Preview branch. It admits one
-- exact five-record adapter, retains two credential-free public Production
-- lineage witnesses, and provides dedicated ingestion/release RPCs.

alter table public.epistemic_ingestion_batches
  drop constraint if exists epistemic_ingestion_batches_adapter_id_check;
alter table public.epistemic_ingestion_batches
  add constraint epistemic_ingestion_batches_adapter_id_check
  check (adapter_id in (
    'semiconductor', 'mathematics', 'astronomy', 'religion',
    'neuromorphic-biocomputing', 'frontier-canary',
    'substantial-batch-2-internal-review', 'substantial-scale-release',
    'repaired-revision-canary', 'mcp-private-canary',
    'source-override-revision-canary', 'batch-11-mixed-lineage-rehearsal'
  ));

alter table public.epistemic_ingestion_records
  drop constraint if exists epistemic_ingestion_records_adapter_id_check;
alter table public.epistemic_ingestion_records
  add constraint epistemic_ingestion_records_adapter_id_check
  check (adapter_id in (
    'semiconductor', 'mathematics', 'astronomy', 'religion',
    'neuromorphic-biocomputing', 'frontier-canary',
    'substantial-batch-2-internal-review', 'substantial-scale-release',
    'repaired-revision-canary', 'mcp-private-canary',
    'source-override-revision-canary', 'batch-11-mixed-lineage-rehearsal'
  ));

-- Public lineage facts are witnesses, not reconstructed canonical releases.
-- Private review prose and authority snapshots are intentionally not public,
-- so no predecessor row is fabricated in the canonical release ledger. The
-- table was introduced by the immutable plan migration; this forward migration
-- narrows its constraints to the exact two public witnesses used by execution.
alter table public.batch_11_rehearsal_imported_lineage
  drop constraint if exists batch_11_rehearsal_imported_lineage_release_check,
  drop constraint if exists batch_11_rehearsal_imported_lineage_digest_check,
  drop constraint if exists batch_11_rehearsal_imported_lineage_allowlist_check;

alter table public.batch_11_rehearsal_imported_lineage
  add constraint batch_11_rehearsal_imported_lineage_release_check
    check (prior_release_id ~ '^epirelease_[a-f0-9]{32}$'),
  add constraint batch_11_rehearsal_imported_lineage_digest_check
    check (prior_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  add constraint batch_11_rehearsal_imported_lineage_allowlist_check check (
    (record_id = 'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium'
      and prior_release_id = 'epirelease_8e947374097d4695815dbf9ab653177b'
      and prior_target_sha256 = 'sha256:cb41216cd3cf8fdc36decedf66f8e768a25b450969b763e83c3d2b756ae57052')
    or
    (record_id = 'urn:maha:record:mechanistic-interpretability-representation-probing-boundary'
      and prior_release_id = 'epirelease_93c92eb7a317465b83fabf8d3e6962da'
      and prior_target_sha256 = 'sha256:83339b28fdea2a81504e0bf44f9229fe06b24e444c774c0a0d513cf1b0bc8b3f')
  );

alter table public.batch_11_rehearsal_imported_lineage enable row level security;
revoke all on public.batch_11_rehearsal_imported_lineage from public, anon, authenticated;
grant select on public.batch_11_rehearsal_imported_lineage to service_role;
revoke insert, update, delete, truncate on public.batch_11_rehearsal_imported_lineage from service_role;

-- The ordinary release ledger requires a local parent row. This disposable
-- branch instead stores the exact external predecessor id on the new release
-- and validates it against the witness table in the dedicated RPC below.
alter table public.epistemic_canonical_releases
  drop constraint if exists epistemic_canonical_releases_supersedes_release_id_fkey;

create or replace function public.record_batch_11_rehearsal_targets(
  p_batch jsonb,
  p_records jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_ingestion_batches%rowtype;
  v_record jsonb;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
    or p_records is null or jsonb_typeof(p_records) <> 'array'
    or coalesce(p_batch->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
    or coalesce(p_batch->>'batchId','') !~ '^epibatch_[a-f0-9]{32}$'
    or coalesce(p_batch->>'adapterId','') <> 'batch-11-mixed-lineage-rehearsal'
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetVersion','') <> 'maha-batch-11-revision-canary/0.1'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') <> '5'
    or jsonb_array_length(p_records) <> 5
    or jsonb_array_length(p_batch#>'{records}') <> 5
    or (select count(distinct record->>'sourceRecordId') from jsonb_array_elements(p_records) record) <> 5
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid Batch 11 rehearsal target batch.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'
      or v_existing.batch_sha256 <> p_batch->>'batchSha256'
    then raise exception 'Batch 11 idempotency cannot cross dataset revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('batchId', v_existing.batch_id, 'recordCount', v_existing.record_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_ingestion_batches (
    batch_id, schema_version, adapter_id, adapter_version, source_dataset_version,
    source_dataset_sha256, batch_sha256, record_count, batch_snapshot,
    actor_fingerprint, idempotency_hash, ingested_at, created_at
  ) values (
    p_batch->>'batchId', p_batch->>'schemaVersion', 'batch-11-mixed-lineage-rehearsal', p_batch->>'adapterVersion', p_batch->>'sourceDatasetVersion',
    p_batch->>'sourceDatasetSha256', p_batch->>'batchSha256', 5, p_batch,
    p_actor_fingerprint, p_idempotency_hash, (p_batch->>'ingestedAt')::timestamptz, now()
  );

  for v_record in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(v_record) <> 'object'
      or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
      or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
      or coalesce(v_record->>'adapterId','') <> 'batch-11-mixed-lineage-rehearsal'
      or coalesce(v_record->>'ingestionRecordId','') !~ '^epirecord_[a-f0-9]{32}$'
      or coalesce(v_record->>'sourceRecordId','') <> coalesce(v_record->>'candidateRecordId','')
      or coalesce(v_record->>'sourceRecordSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'sourcePublicPath','') !~ '^/knowledge/[a-z0-9/_-]+$'
      or coalesce(v_record->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record#>>'{gateDecision,publicEligible}','false') <> 'false'
      or coalesce(v_record#>>'{alignmentDecision,canonicalEligible}','false') <> 'true'
      or coalesce(v_record#>>'{alignmentDecision,contentInspectionState}','') <> 'internally-inspected-batch-11-revision'
      or coalesce(v_record#>>'{candidateSnapshot,id}','') <> v_record->>'candidateRecordId'
      or coalesce(v_record#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
      or coalesce(v_record#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
      or not exists (
        select 1 from (values
          ('urn:maha:record:advanced-materials-color-centers-in-diamond', 'sha256:96630a6fbe09aa7d0d239f37add3d6691d996445140812c876d676c67d69139f'),
          ('urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium', 'sha256:26d193fe87af63e481f46db94638658c5be0df199ae55bb642f37edf45100bd7'),
          ('urn:maha:record:longevity-metabolism-mitophagy-flux', 'sha256:7bbef3b54fb9ac405c78bb7d819f75e34f949ab33b4c9ac764dd844e5f641ab2'),
          ('urn:maha:record:mechanistic-interpretability-activation-patching', 'sha256:ef3182227b26a0902ad4848505fe5eb59dc310cfa30c18524f754b16dd4fd86c'),
          ('urn:maha:record:mechanistic-interpretability-representation-probing-boundary', 'sha256:8485532ea6985bb77144951944066525e7f7d957b01ebfe55547627c07c1fcf8')
        ) allowed(record_id, target_sha256)
        where allowed.record_id = v_record->>'candidateRecordId'
          and allowed.target_sha256 = v_record->>'reviewTargetSha256'
      )
    then raise exception 'Invalid Batch 11 rehearsal target.' using errcode = '22023'; end if;

    insert into public.epistemic_ingestion_records (
      ingestion_record_id, batch_id, adapter_id, source_record_id, source_record_sha256,
      source_public_path, candidate_record_id, candidate_sha256, review_target_sha256,
      public_eligible, gate_decision, record_snapshot, created_at
    ) values (
      v_record->>'ingestionRecordId', p_batch->>'batchId', 'batch-11-mixed-lineage-rehearsal', v_record->>'sourceRecordId', v_record->>'sourceRecordSha256',
      v_record->>'sourcePublicPath', v_record->>'candidateRecordId', v_record->>'candidateSha256', v_record->>'reviewTargetSha256',
      false, v_record->'gateDecision', v_record, (p_batch->>'ingestedAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('batchId', p_batch->>'batchId', 'recordCount', 5, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_batch_11_rehearsal_targets(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_batch_11_rehearsal_targets(jsonb,jsonb,text,text) to service_role;

create or replace function public.record_batch_11_rehearsal_canonical_release(
  p_release jsonb,
  p_authority_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_canonical_releases%rowtype;
  v_target public.epistemic_ingestion_records%rowtype;
  v_witness public.batch_11_rehearsal_imported_lineage%rowtype;
  v_scope text;
  v_scope_count integer := 0;
  v_review public.epistemic_expert_review_decisions%rowtype;
  v_reason text;
  v_expected_path text;
begin
  if p_release is null or jsonb_typeof(p_release) <> 'object'
    or coalesce(p_release->>'schemaVersion','') <> 'maha-epistemic-release/1.0'
    or coalesce(p_release->>'releaseId','') !~ '^epirelease_[a-f0-9]{32}$'
    or coalesce(p_release->>'releaseKind','') not in ('initial','superseding')
    or coalesce(p_release->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_release->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_release->>'canonicalVersion','') !~ '^batch-11-preview-[a-z0-9._-]+$'
    or jsonb_typeof(p_release->'approvals') <> 'array' or jsonb_array_length(p_release->'approvals') <> 4
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
  then raise exception 'Invalid Batch 11 rehearsal release.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_canonical_releases where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('releaseId', v_existing.release_id, 'canonicalPath', v_existing.canonical_path, 'idempotentReplay', true); end if;
  if exists (select 1 from public.epistemic_canonical_releases where candidate_record_id = p_release->>'recordId')
  then raise exception 'Batch 11 rehearsal permits exactly one new release per record.' using errcode = 'P0001'; end if;

  select * into v_target from public.epistemic_ingestion_records
    where adapter_id = 'batch-11-mixed-lineage-rehearsal'
      and candidate_record_id = p_release->>'recordId'
      and review_target_sha256 = p_release->>'targetSha256'
    order by created_at desc limit 1;
  if not found then raise exception 'Exact Batch 11 target not found.' using errcode = 'P0002'; end if;
  -- Parenthesised because `-` binds tighter than `->`: without them Postgres
  -- reads this as record_snapshot -> ('candidateSnapshot' - 'publication'),
  -- which is `unknown - unknown` and raises 42725 before the comparison ever
  -- happens. The check below is the one that proves released content equals the
  -- frozen target, so it was not weak - it was unreachable.
  if (v_target.record_snapshot->'candidateSnapshot') - 'publication' <> (p_release->'recordSnapshot') - 'publication'
  then raise exception 'Released content differs from the frozen Batch 11 target.' using errcode = 'P0001'; end if;
  if v_target.record_snapshot#>>'{candidateSnapshot,id}' <> p_release->>'recordId'
    or v_target.record_snapshot#>>'{candidateSnapshot,domainSlug}' <> p_release->>'domainSlug'
  then raise exception 'Released identity differs from the frozen Batch 11 target.' using errcode = 'P0001'; end if;

  for v_reason in select jsonb_array_elements_text(coalesce(v_target.gate_decision->'reasons','[]'::jsonb)) loop
    if v_reason not in ('public-promotion-not-requested','review-state-not-canonical','publication-date-missing','canonical-version-missing','approval-review-missing')
      and v_reason not like 'expert-review-%'
    then raise exception 'The frozen Batch 11 target retains a non-release blocker: %', v_reason using errcode = 'P0001'; end if;
  end loop;

  v_expected_path := format('/knowledge/%s/%s/%s',
    v_target.record_snapshot#>>'{candidateSnapshot,domainSlug}',
    case when v_target.record_snapshot#>>'{candidateSnapshot,recordKind}' = 'hypothesis'
      then 'hypotheses'
      else (v_target.record_snapshot#>>'{candidateSnapshot,recordKind}') || 's'
    end,
    v_target.record_snapshot#>>'{candidateSnapshot,slug}');
  if p_release->>'canonicalPath' <> v_expected_path
    or p_release#>>'{recordSnapshot,publication,requestedPublicPromotion}' <> 'true'
    or p_release#>>'{recordSnapshot,publication,reviewState}' <> 'published-canonical'
    or p_release#>>'{recordSnapshot,publication,canonicalVersion}' <> p_release->>'canonicalVersion'
    or coalesce(p_release#>>'{recordSnapshot,publication,publishedAt}','') !~ '^\d{4}-\d{2}-\d{2}$'
  then raise exception 'Batch 11 canonical publication controls or path are invalid.' using errcode = 'P0001'; end if;

  for v_scope in select jsonb_array_elements_text(v_target.record_snapshot#>'{candidateSnapshot,publication,requiredReviewScopes}') loop
    v_scope_count := v_scope_count + 1;
    select * into v_review from public.epistemic_expert_review_decisions
      where candidate_record_id = p_release->>'recordId'
        and target_sha256 = p_release->>'targetSha256'
        and review_scope = v_scope
      order by reviewed_at desc, created_at desc limit 1;
    if not found or v_review.decision <> 'approve'
    then raise exception 'Batch 11 scope % lacks an exact approval.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release->'approvals') approval
      where approval->>'scope' = v_scope
        and approval->>'reviewId' = v_review.review_id
        and approval->>'reviewSha256' = v_review.review_sha256
    ) then raise exception 'Batch 11 approval manifest does not match %.', v_scope using errcode = 'P0001'; end if;
    if not exists (
      select 1 from jsonb_array_elements(p_release#>'{recordSnapshot,publication,reviewEvents}') event
      where event->>'scope' = v_scope
        and event->>'reviewId' = v_review.review_id
        and event->>'targetSha256' = p_release->>'targetSha256'
        and event->>'verdict' = 'approve'
    ) then raise exception 'Batch 11 canonical record does not embed the exact % approval.', v_scope using errcode = 'P0001'; end if;
  end loop;
  if v_scope_count <> 4 then raise exception 'Batch 11 requires four exact review scopes.' using errcode = 'P0001'; end if;

  select * into v_witness from public.batch_11_rehearsal_imported_lineage where record_id = p_release->>'recordId';
  if found then
    if p_release->>'releaseKind' <> 'superseding'
      or p_release->>'supersedesReleaseId' <> v_witness.prior_release_id
      or p_release->>'targetSha256' = v_witness.prior_target_sha256
    then raise exception 'Batch 11 superseding release does not match its external predecessor witness.' using errcode = 'P0001'; end if;
  elsif p_release->>'releaseKind' <> 'initial' or nullif(p_release->>'supersedesReleaseId','') is not null then
    raise exception 'Batch 11 initial release cannot supersede anything.' using errcode = 'P0001';
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

revoke all on function public.record_batch_11_rehearsal_canonical_release(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.record_batch_11_rehearsal_canonical_release(jsonb,text,text,text) to service_role;

create table if not exists public.batch_11_rehearsal_observations (
  id bigserial primary key,
  phase text not null check (phase in (
    'provision-ephemeral-branch', 'import-prior-lineages', 'apply-migrations',
    'ingest-revisions-and-decisions', 'issue-releases',
    'verify-transitions', 'destroy-ephemeral-branch'
  )),
  status text not null check (status in ('executed','refused','skipped')),
  detail text not null,
  observed_at timestamptz not null default now()
);
revoke update, delete on public.batch_11_rehearsal_observations from public;

comment on table public.batch_11_rehearsal_imported_lineage is
  'Two exact public Production predecessor witnesses. These are not reconstructed release snapshots.';
comment on function public.record_batch_11_rehearsal_targets(jsonb,jsonb,text,text) is
  'Persists only the exact five inspected Batch 11 revised targets in an ephemeral Preview branch.';
comment on function public.record_batch_11_rehearsal_canonical_release(jsonb,text,text,text) is
  'Preview-only exact-cohort release RPC. External predecessors must match the imported public lineage witnesses.';

notify pgrst, 'reload schema';
