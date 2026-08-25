-- Append-only machine verification evidence for the 48 source contracts used
-- by the 240 frontier-domain candidates. This ledger cannot create reviews or
-- releases; those remain separate exact-hash decisions.

create table if not exists public.epistemic_source_verification_runs (
  report_id text primary key check (report_id ~ '^episourceverify_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'frontier-source-verification-report/1.0'),
  verifier_version text not null check (verifier_version = 'frontier-source-verifier/1.0'),
  cohort text not null check (cohort = 'frontier-240'),
  source_count integer not null check (source_count = 48),
  record_count integer not null check (record_count = 240),
  verified_count integer not null check (verified_count between 0 and 48),
  failed_count integer not null check (failed_count between 0 and 48),
  report_sha256 text not null unique check (report_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  report_snapshot jsonb not null check (jsonb_typeof(report_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (verified_count + failed_count = 48),
  check (jsonb_array_length(report_snapshot->'results') = 48),
  check (report_snapshot->>'reportSha256' = report_sha256)
);

create index if not exists epistemic_source_verification_runs_cohort_idx
  on public.epistemic_source_verification_runs (cohort, verified_at desc);

create trigger epistemic_source_verification_runs_immutable
  before update or delete on public.epistemic_source_verification_runs
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_source_verification_runs enable row level security;
revoke all on table public.epistemic_source_verification_runs from public, anon, authenticated;
grant select on table public.epistemic_source_verification_runs to service_role;
revoke insert, update, delete, truncate on table public.epistemic_source_verification_runs from service_role;

create or replace function public.record_epistemic_source_verification_run(
  p_report jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_source_verification_runs%rowtype;
  v_verified integer;
  v_failed integer;
begin
  if p_report is null or jsonb_typeof(p_report) <> 'object'
    or coalesce(p_report->>'schemaVersion','') <> 'frontier-source-verification-report/1.0'
    or coalesce(p_report->>'verifierVersion','') <> 'frontier-source-verifier/1.0'
    or coalesce(p_report->>'reportId','') !~ '^episourceverify_[a-f0-9]{32}$'
    or coalesce(p_report->>'cohort','') <> 'frontier-240'
    or coalesce(p_report->>'sourceCount','') <> '48'
    or coalesce(p_report->>'recordCount','') <> '240'
    or coalesce(jsonb_typeof(p_report->'results'),'') <> 'array'
    or jsonb_array_length(p_report->'results') <> 48
    or (select count(distinct result->>'sourceId') from jsonb_array_elements(p_report->'results') result) <> 48
    or exists (
      select 1 from jsonb_array_elements(p_report->'results') result
      where coalesce(result->>'sourceId','') !~ '^source-[a-z0-9-]+$'
        or coalesce(result->>'domainSlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        or coalesce(result->>'expectedMetadataSha256','') !~ '^sha256:[a-f0-9]{64}$'
        or coalesce(result->>'status','') not in ('verified','failed')
        or coalesce(result->>'metadataStatus','') not in ('registry-confirmed','authoritative-url-confirmed','unresolved')
        or coalesce(result->>'locatorStatus','') not in ('content-confirmed','structured-locator-confirmed','unresolved')
        or coalesce(jsonb_typeof(result->'recordIds'),'') <> 'array'
        or jsonb_array_length(result->'recordIds') <> 5
    )
    or coalesce(p_report->>'reportSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_report->>'verifiedAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid frontier source-verification report.' using errcode = '22023'; end if;

  select count(*) filter (where result->>'status' = 'verified'),
    count(*) filter (where result->>'status' = 'failed')
    into v_verified, v_failed from jsonb_array_elements(p_report->'results') result;
  if v_verified <> (p_report#>>'{summary,verified}')::integer
    or v_failed <> (p_report#>>'{summary,failed}')::integer
  then raise exception 'Source-verification summary does not match its results.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_source_verification_runs where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.report_sha256 <> p_report->>'reportSha256'
    then raise exception 'Source-verification idempotency cannot cross report digests.' using errcode = 'P0001'; end if;
    return jsonb_build_object('reportId', v_existing.report_id, 'reportSha256', v_existing.report_sha256, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_source_verification_runs (
    report_id, schema_version, verifier_version, cohort, source_count, record_count,
    verified_count, failed_count, report_sha256, report_snapshot,
    actor_fingerprint, idempotency_hash, verified_at, created_at
  ) values (
    p_report->>'reportId', p_report->>'schemaVersion', p_report->>'verifierVersion', p_report->>'cohort',
    48, 240, v_verified, v_failed, p_report->>'reportSha256', p_report,
    p_actor_fingerprint, p_idempotency_hash, (p_report->>'verifiedAt')::timestamptz, now()
  );
  return jsonb_build_object('reportId', p_report->>'reportId', 'reportSha256', p_report->>'reportSha256', 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_source_verification_run(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_source_verification_run(jsonb,text,text) to service_role;

comment on table public.epistemic_source_verification_runs is
  'Immutable machine observations for source metadata, resolution, and locator evidence. A run is neither expert endorsement nor publication authorization.';

notify pgrst, 'reload schema';

-- The original ingestion adapter enumeration predates the factory. Permit one
-- bounded adapter for the pre-registered 40-record canary; it is deliberately
-- excluded from the public legacy-migration inventory.
alter table public.epistemic_ingestion_batches drop constraint if exists epistemic_ingestion_batches_adapter_id_check;
alter table public.epistemic_ingestion_batches add constraint epistemic_ingestion_batches_adapter_id_check
  check (adapter_id in ('semiconductor','mathematics','astronomy','religion','neuromorphic-biocomputing','frontier-canary'));
alter table public.epistemic_ingestion_records drop constraint if exists epistemic_ingestion_records_adapter_id_check;
alter table public.epistemic_ingestion_records add constraint epistemic_ingestion_records_adapter_id_check
  check (adapter_id in ('semiconductor','mathematics','astronomy','religion','neuromorphic-biocomputing','frontier-canary'));

create or replace function public.record_epistemic_frontier_canary_batch(
  p_batch jsonb,
  p_records jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_ingestion_batches%rowtype;
  v_record jsonb;
  v_count integer;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
    or p_records is null or jsonb_typeof(p_records) <> 'array'
    or coalesce(p_batch->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
    or coalesce(p_batch->>'batchId','') !~ '^epibatch_[a-f0-9]{32}$'
    or coalesce(p_batch->>'adapterId','') <> 'frontier-canary'
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetVersion','') <> 'frontier-canonicalization-canary/1.0'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') <> '40'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid frontier canary ingestion batch.' using errcode = '22023'; end if;

  v_count := jsonb_array_length(p_records);
  if v_count <> 40 or jsonb_array_length(p_batch#>'{records}') <> 40
  then raise exception 'Frontier canary ingestion must contain exactly 40 records.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'
    then raise exception 'Frontier canary idempotency cannot cross dataset revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('batchId', v_existing.batch_id, 'recordCount', v_existing.record_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_ingestion_batches (
    batch_id, schema_version, adapter_id, adapter_version, source_dataset_version,
    source_dataset_sha256, batch_sha256, record_count, batch_snapshot,
    actor_fingerprint, idempotency_hash, ingested_at, created_at
  ) values (
    p_batch->>'batchId', p_batch->>'schemaVersion', 'frontier-canary', p_batch->>'adapterVersion', p_batch->>'sourceDatasetVersion',
    p_batch->>'sourceDatasetSha256', p_batch->>'batchSha256', 40, p_batch,
    p_actor_fingerprint, p_idempotency_hash, (p_batch->>'ingestedAt')::timestamptz, now()
  );

  for v_record in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(v_record) <> 'object'
      or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
      or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
      or coalesce(v_record->>'adapterId','') <> 'frontier-canary'
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
    then raise exception 'Invalid frontier canary ingestion record.' using errcode = '22023'; end if;

    insert into public.epistemic_ingestion_records (
      ingestion_record_id, batch_id, adapter_id, source_record_id, source_record_sha256,
      source_public_path, candidate_record_id, candidate_sha256, review_target_sha256,
      public_eligible, gate_decision, record_snapshot, created_at
    ) values (
      v_record->>'ingestionRecordId', p_batch->>'batchId', 'frontier-canary', v_record->>'sourceRecordId', v_record->>'sourceRecordSha256',
      v_record->>'sourcePublicPath', v_record->>'candidateRecordId', v_record->>'candidateSha256', v_record->>'reviewTargetSha256',
      false, v_record->'gateDecision', v_record, (p_batch->>'ingestedAt')::timestamptz
    );
  end loop;
  return jsonb_build_object('batchId', p_batch->>'batchId', 'recordCount', 40, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_frontier_canary_batch(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_frontier_canary_batch(jsonb,jsonb,text,text) to service_role;

comment on function public.record_epistemic_frontier_canary_batch(jsonb,jsonb,text,text) is
  'Creates exact-hash review targets for only the pre-registered 40-record frontier canary. It cannot promote records or ingest the 200 controls.';

notify pgrst, 'reload schema';
