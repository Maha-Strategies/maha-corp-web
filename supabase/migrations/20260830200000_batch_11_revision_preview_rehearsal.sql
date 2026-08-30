-- Preview-only support for the five exact Batch 11 revisions. This migration
-- freezes draft review targets; it cannot create decisions or releases.
alter table public.epistemic_ingestion_batches
  drop constraint if exists epistemic_ingestion_batches_adapter_id_check;
alter table public.epistemic_ingestion_batches
  add constraint epistemic_ingestion_batches_adapter_id_check
  check (adapter_id in (
    'semiconductor', 'mathematics', 'astronomy', 'religion',
    'neuromorphic-biocomputing', 'frontier-canary',
    'substantial-batch-2-internal-review', 'repaired-revision-canary',
    'mcp-private-canary', 'source-override-revision-canary',
    'batch-11-revision-canary'
  ));

alter table public.epistemic_ingestion_records
  drop constraint if exists epistemic_ingestion_records_adapter_id_check;
alter table public.epistemic_ingestion_records
  add constraint epistemic_ingestion_records_adapter_id_check
  check (adapter_id in (
    'semiconductor', 'mathematics', 'astronomy', 'religion',
    'neuromorphic-biocomputing', 'frontier-canary',
    'substantial-batch-2-internal-review', 'repaired-revision-canary',
    'mcp-private-canary', 'source-override-revision-canary',
    'batch-11-revision-canary'
  ));

create or replace function public.record_batch_11_revision_canary_targets(
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
    or coalesce(p_batch->>'adapterId','') <> 'batch-11-revision-canary'
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetVersion','') <> 'maha-batch-11-revision-ingestion/1.0'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') <> '5'
    or jsonb_array_length(p_records) <> 5
    or jsonb_array_length(p_batch#>'{records}') <> 5
    or (select count(distinct record->>'sourceRecordId') from jsonb_array_elements(p_records) record) <> 5
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid Batch 11 revision target batch.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'
      or v_existing.batch_sha256 <> p_batch->>'batchSha256'
    then raise exception 'Batch 11 revision idempotency cannot cross dataset revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('batchId', v_existing.batch_id, 'recordCount', v_existing.record_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_ingestion_batches (
    batch_id, schema_version, adapter_id, adapter_version, source_dataset_version,
    source_dataset_sha256, batch_sha256, record_count, batch_snapshot,
    actor_fingerprint, idempotency_hash, ingested_at, created_at
  ) values (
    p_batch->>'batchId', p_batch->>'schemaVersion', 'batch-11-revision-canary', p_batch->>'adapterVersion', p_batch->>'sourceDatasetVersion',
    p_batch->>'sourceDatasetSha256', p_batch->>'batchSha256', 5, p_batch,
    p_actor_fingerprint, p_idempotency_hash, (p_batch->>'ingestedAt')::timestamptz, now()
  );

  for v_record in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(v_record) <> 'object'
      or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
      or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
      or coalesce(v_record->>'adapterId','') <> 'batch-11-revision-canary'
      or coalesce(v_record->>'ingestionRecordId','') !~ '^epirecord_[a-f0-9]{32}$'
      or coalesce(v_record->>'sourceRecordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(v_record->>'sourceRecordSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'sourcePublicPath','') !~ '^/knowledge/[a-z0-9/_-]+$'
      or coalesce(v_record->>'candidateRecordId','') <> v_record->>'sourceRecordId'
      or coalesce(v_record->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record#>>'{gateDecision,publicEligible}','false') <> 'false'
      or coalesce(v_record#>>'{alignmentDecision,canonicalEligible}','false') <> 'true'
      or coalesce(v_record#>>'{alignmentDecision,contentInspectionState}','') <> 'internally-inspected-batch-11-revision'
      or coalesce(v_record#>>'{candidateSnapshot,id}','') <> v_record->>'candidateRecordId'
      or coalesce(v_record#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
      or coalesce(v_record#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
    then raise exception 'Invalid Batch 11 revision target.' using errcode = '22023'; end if;

    insert into public.epistemic_ingestion_records (
      ingestion_record_id, batch_id, adapter_id, source_record_id, source_record_sha256,
      source_public_path, candidate_record_id, candidate_sha256, review_target_sha256,
      public_eligible, gate_decision, record_snapshot, created_at
    ) values (
      v_record->>'ingestionRecordId', p_batch->>'batchId', 'batch-11-revision-canary', v_record->>'sourceRecordId', v_record->>'sourceRecordSha256',
      v_record->>'sourcePublicPath', v_record->>'candidateRecordId', v_record->>'candidateSha256', v_record->>'reviewTargetSha256',
      false, v_record->'gateDecision', v_record, (p_batch->>'ingestedAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('batchId', p_batch->>'batchId', 'recordCount', 5, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_batch_11_revision_canary_targets(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_batch_11_revision_canary_targets(jsonb,jsonb,text,text) to service_role;

comment on function public.record_batch_11_revision_canary_targets(jsonb,jsonb,text,text) is
  'Persists only the frozen five-record Batch 11 exact-revision cohort as draft review targets. It cannot create review decisions or canonical releases.';

-- Bootstrap only the four already-public prior lineage heads into an empty,
-- ephemeral Preview branch. The exact ids, target digests and paths are frozen
-- below. This is a Preview rehearsal fixture, not a new canonical decision.
create or replace function public.bootstrap_batch_11_preview_prior_lineages(
  p_fixtures jsonb,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fixture jsonb;
  v_count integer := 0;
begin
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array'
    or jsonb_array_length(p_fixtures) <> 4
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid Batch 11 prior-lineage fixture set.' using errcode = '22023'; end if;

  for v_fixture in select value from jsonb_array_elements(p_fixtures) loop
    if jsonb_typeof(v_fixture) <> 'object'
      or coalesce(v_fixture->>'releaseId','') !~ '^epirelease_[a-f0-9]{32}$'
      or coalesce(v_fixture->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(v_fixture->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_fixture->>'canonicalPath','') !~ '^/knowledge/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$'
      or coalesce(v_fixture->>'schemaVersion','') <> 'maha-epistemic-release/1.0'
      or coalesce(v_fixture->>'releaseKind','') <> 'initial'
      or jsonb_typeof(v_fixture->'approvals') <> 'array'
      or jsonb_array_length(v_fixture->'approvals') <> 4
      or jsonb_typeof(v_fixture->'authority') <> 'object'
      or coalesce(v_fixture->>'authoritySha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_fixture->>'recordSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_fixture->>'releaseSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_fixture->>'idempotencyHash','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_fixture->>'releasedAt','') !~ 'Z$'
      or jsonb_typeof(v_fixture->'recordSnapshot') <> 'object'
      or coalesce(v_fixture#>>'{recordSnapshot,id}','') <> v_fixture->>'recordId'
    then raise exception 'Invalid Batch 11 prior-lineage fixture.' using errcode = '22023'; end if;

    if not (
      (v_fixture->>'releaseId' = 'epirelease_9bf9b14ec8fb48f884efdc43e44ea349' and v_fixture->>'targetSha256' = 'sha256:2f59ecb93f3ad9418b05e01058d2d629fff5368dcc20b838b0e996f651c1db50' and v_fixture->>'canonicalPath' = '/knowledge/biomolecular-engineering/comparisons/biomolecular-engineering-structure-prediction-filtering')
      or (v_fixture->>'releaseId' = 'epirelease_d9b0cd28c1614fa58192be24afcd2a7a' and v_fixture->>'targetSha256' = 'sha256:c667320cf234997948bffc6fef2aefd2133010aed2a0af4d457dad0817fd93c0' and v_fixture->>'canonicalPath' = '/knowledge/critical-supply-chains/concepts/critical-supply-chains-high-purity-quartz-deposits')
      or (v_fixture->>'releaseId' = 'epirelease_8e947374097d4695815dbf9ab653177b' and v_fixture->>'targetSha256' = 'sha256:cb41216cd3cf8fdc36decedf66f8e768a25b450969b763e83c3d2b756ae57052' and v_fixture->>'canonicalPath' = '/knowledge/fusion-plasma-systems/mechanisms/fusion-plasma-systems-tokamak-plasma-equilibrium')
      or (v_fixture->>'releaseId' = 'epirelease_93c92eb7a317465b83fabf8d3e6962da' and v_fixture->>'targetSha256' = 'sha256:83339b28fdea2a81504e0bf44f9229fe06b24e444c774c0a0d513cf1b0bc8b3f' and v_fixture->>'canonicalPath' = '/knowledge/mechanistic-interpretability/comparisons/mechanistic-interpretability-representation-probing-boundary')
    ) then raise exception 'Batch 11 prior-lineage fixture is outside the frozen allowlist.' using errcode = 'P0001'; end if;

    insert into public.epistemic_canonical_releases (
      release_id, schema_version, release_kind, candidate_record_id, domain_slug,
      target_sha256, canonical_path, canonical_version, supersedes_release_id,
      approvals, authority_id, authority_sha256, authority_snapshot,
      public_change_summary, rationale, record_sha256, record_snapshot,
      gate_decision, release_sha256, release_snapshot, actor_fingerprint,
      idempotency_hash, released_at, created_at
    ) values (
      v_fixture->>'releaseId', 'maha-epistemic-release/1.0', 'initial',
      v_fixture->>'recordId', v_fixture->>'domainSlug', v_fixture->>'targetSha256',
      v_fixture->>'canonicalPath', v_fixture->>'canonicalVersion', null,
      v_fixture->'approvals',
      v_fixture#>>'{authority,authorityId}',
      v_fixture->>'authoritySha256',
      v_fixture->'authority',
      v_fixture->>'publicChangeSummary',
      v_fixture->>'rationale',
      v_fixture->>'recordSha256', v_fixture->'recordSnapshot',
      v_fixture->'gateDecision',
      v_fixture->>'releaseSha256', v_fixture,
      p_actor_fingerprint, v_fixture->>'idempotencyHash',
      (v_fixture->>'releasedAt')::timestamptz, now()
    ) on conflict (release_id) do nothing;
    v_count := v_count + 1;
  end loop;

  if (select count(*) from public.epistemic_canonical_releases where release_id in (
    'epirelease_9bf9b14ec8fb48f884efdc43e44ea349',
    'epirelease_d9b0cd28c1614fa58192be24afcd2a7a',
    'epirelease_8e947374097d4695815dbf9ab653177b',
    'epirelease_93c92eb7a317465b83fabf8d3e6962da'
  )) <> 4 then raise exception 'Batch 11 prior-lineage fixture set did not converge.' using errcode = 'P0001'; end if;

  return jsonb_build_object('fixtureCount', v_count, 'activePriorLineages', 4);
end; $$;

revoke all on function public.bootstrap_batch_11_preview_prior_lineages(jsonb,text) from public, anon, authenticated;
grant execute on function public.bootstrap_batch_11_preview_prior_lineages(jsonb,text) to service_role;

comment on function public.bootstrap_batch_11_preview_prior_lineages(jsonb,text) is
  'Preview-only exact allowlist bootstrap for four already-public Batch 11 lineage heads. Never apply this dedicated rehearsal migration to Production.';

notify pgrst, 'reload schema';
