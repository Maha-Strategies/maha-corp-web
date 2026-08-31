-- Freeze exactly the five source-override revisions as draft review targets.
-- This RPC cannot create decisions or releases and is applied to Preview first.
create or replace function public.record_source_override_revision_canary_targets(
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
    or coalesce(p_batch->>'adapterId','') <> 'source-override-revision-canary'
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetVersion','') <> 'maha-source-override-revision-canary/0.1'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') <> '5'
    or jsonb_array_length(p_records) <> 5
    or jsonb_array_length(p_batch#>'{records}') <> 5
    or (select count(distinct record->>'sourceRecordId') from jsonb_array_elements(p_records) record) <> 5
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid source-override revision canary target batch.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'
      or v_existing.batch_sha256 <> p_batch->>'batchSha256'
    then raise exception 'Source-override revision canary idempotency cannot cross dataset revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('batchId', v_existing.batch_id, 'recordCount', v_existing.record_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_ingestion_batches (
    batch_id, schema_version, adapter_id, adapter_version, source_dataset_version,
    source_dataset_sha256, batch_sha256, record_count, batch_snapshot,
    actor_fingerprint, idempotency_hash, ingested_at, created_at
  ) values (
    p_batch->>'batchId', p_batch->>'schemaVersion', 'source-override-revision-canary', p_batch->>'adapterVersion', p_batch->>'sourceDatasetVersion',
    p_batch->>'sourceDatasetSha256', p_batch->>'batchSha256', 5, p_batch,
    p_actor_fingerprint, p_idempotency_hash, (p_batch->>'ingestedAt')::timestamptz, now()
  );

  for v_record in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(v_record) <> 'object'
      or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
      or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
      or coalesce(v_record->>'adapterId','') <> 'source-override-revision-canary'
      or coalesce(v_record->>'ingestionRecordId','') !~ '^epirecord_[a-f0-9]{32}$'
      or coalesce(v_record->>'sourceRecordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(v_record->>'sourceRecordSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'sourcePublicPath','') !~ '^/knowledge/[a-z0-9/_-]+$'
      or coalesce(v_record->>'candidateRecordId','') <> v_record->>'sourceRecordId'
      or coalesce(v_record->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record#>>'{gateDecision,publicEligible}','false') <> 'false'
      or coalesce(v_record#>>'{candidateSnapshot,id}','') <> v_record->>'candidateRecordId'
      or coalesce(v_record#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
      or coalesce(v_record#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
    then raise exception 'Invalid source-override revision canary target.' using errcode = '22023'; end if;

    insert into public.epistemic_ingestion_records (
      ingestion_record_id, batch_id, adapter_id, source_record_id, source_record_sha256,
      source_public_path, candidate_record_id, candidate_sha256, review_target_sha256,
      public_eligible, gate_decision, record_snapshot, created_at
    ) values (
      v_record->>'ingestionRecordId', p_batch->>'batchId', 'source-override-revision-canary', v_record->>'sourceRecordId', v_record->>'sourceRecordSha256',
      v_record->>'sourcePublicPath', v_record->>'candidateRecordId', v_record->>'candidateSha256', v_record->>'reviewTargetSha256',
      false, v_record->'gateDecision', v_record, (p_batch->>'ingestedAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('batchId', p_batch->>'batchId', 'recordCount', 5, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_source_override_revision_canary_targets(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_source_override_revision_canary_targets(jsonb,jsonb,text,text) to service_role;

comment on function public.record_source_override_revision_canary_targets(jsonb,jsonb,text,text) is
  'Persists only the frozen five-record source-override revision cohort as draft review targets. It cannot create review decisions or publish records.';

notify pgrst, 'reload schema';
