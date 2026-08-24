-- Durable, append-only ingestion and expert review for the Maha Epistemic
-- Publication System. Imported records remain candidates; no function here can
-- publish a page or express product approval.

create table if not exists public.epistemic_ingestion_batches (
  batch_id text primary key check (batch_id ~ '^epibatch_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-ingestion/1.0'),
  adapter_id text not null check (adapter_id in ('semiconductor','mathematics','astronomy','religion','neuromorphic-biocomputing')),
  adapter_version text not null check (adapter_version = 'maha-epistemic-adapter/1.0'),
  source_dataset_version text not null check (char_length(source_dataset_version) between 3 and 120),
  source_dataset_sha256 text not null check (source_dataset_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  batch_sha256 text not null unique check (batch_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  record_count integer not null check (record_count between 1 and 500),
  batch_snapshot jsonb not null check (jsonb_typeof(batch_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  ingested_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.epistemic_ingestion_records (
  ingestion_record_id text primary key check (ingestion_record_id ~ '^epirecord_[a-f0-9]{32}$'),
  batch_id text not null references public.epistemic_ingestion_batches(batch_id) on delete restrict,
  adapter_id text not null check (adapter_id in ('semiconductor','mathematics','astronomy','religion','neuromorphic-biocomputing')),
  source_record_id text not null check (char_length(source_record_id) between 3 and 180),
  source_record_sha256 text not null check (source_record_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  source_public_path text not null check (source_public_path ~ '^/knowledge/[a-z0-9/_-]+$'),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  candidate_sha256 text not null check (candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_target_sha256 text not null check (review_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  public_eligible boolean not null check (public_eligible = false),
  gate_decision jsonb not null check (jsonb_typeof(gate_decision) = 'object'),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (batch_id, source_record_id),
  unique (batch_id, candidate_record_id)
);

create index if not exists epistemic_ingestion_batches_adapter_idx
  on public.epistemic_ingestion_batches (adapter_id, ingested_at desc);
create index if not exists epistemic_ingestion_records_target_idx
  on public.epistemic_ingestion_records (candidate_record_id, review_target_sha256, created_at desc);

create table if not exists public.epistemic_expert_reviewer_profiles (
  reviewer_id text not null check (reviewer_id ~ '^expert_[a-z0-9][a-z0-9_-]{6,63}$'),
  profile_version integer not null check (profile_version > 0),
  profile_sha256 text not null check (profile_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  profile_snapshot jsonb not null check (jsonb_typeof(profile_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (reviewer_id, profile_version)
);

create table if not exists public.epistemic_expert_review_decisions (
  review_id text primary key check (review_id ~ '^epireview_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-review/1.0'),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  domain_slug text not null check (domain_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  target_sha256 text not null check (target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_scope text not null check (review_scope in ('source-fidelity','domain-fidelity','boundary-adequacy','rights-and-locator')),
  reviewer_id text not null,
  reviewer_profile_version integer not null,
  decision text not null check (decision in ('approve','approve-with-reservations','request-changes','abstain')),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) = 3),
  disagreements jsonb not null check (jsonb_typeof(disagreements) = 'array' and jsonb_array_length(disagreements) <= 20),
  rationale text not null check (char_length(rationale) between 20 and 4000),
  supersedes_review_id text unique references public.epistemic_expert_review_decisions(review_id) on delete restrict,
  review_sha256 text not null unique check (review_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_snapshot jsonb not null check (jsonb_typeof(review_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (reviewer_id, reviewer_profile_version)
    references public.epistemic_expert_reviewer_profiles(reviewer_id, profile_version)
);

create index if not exists epistemic_expert_reviews_target_idx
  on public.epistemic_expert_review_decisions (candidate_record_id, target_sha256, review_scope, reviewed_at desc);
create index if not exists epistemic_expert_reviews_reviewer_idx
  on public.epistemic_expert_review_decisions (reviewer_id, reviewer_profile_version, reviewed_at desc);

create or replace function public.reject_epistemic_ledger_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Epistemic ingestion and review ledgers are append-only.' using errcode = '55000';
end; $$;

create trigger epistemic_ingestion_batches_immutable
  before update or delete on public.epistemic_ingestion_batches
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_ingestion_records_immutable
  before update or delete on public.epistemic_ingestion_records
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_reviewer_profiles_immutable
  before update or delete on public.epistemic_expert_reviewer_profiles
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_review_decisions_immutable
  before update or delete on public.epistemic_expert_review_decisions
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_ingestion_batches enable row level security;
alter table public.epistemic_ingestion_records enable row level security;
alter table public.epistemic_expert_reviewer_profiles enable row level security;
alter table public.epistemic_expert_review_decisions enable row level security;

revoke all on table
  public.epistemic_ingestion_batches,
  public.epistemic_ingestion_records,
  public.epistemic_expert_reviewer_profiles,
  public.epistemic_expert_review_decisions
from public, anon, authenticated;

grant select on table
  public.epistemic_ingestion_batches,
  public.epistemic_ingestion_records,
  public.epistemic_expert_reviewer_profiles,
  public.epistemic_expert_review_decisions
to service_role;

revoke insert, update, delete, truncate on table
  public.epistemic_ingestion_batches,
  public.epistemic_ingestion_records,
  public.epistemic_expert_reviewer_profiles,
  public.epistemic_expert_review_decisions
from service_role;

create or replace function public.record_epistemic_ingestion_batch(
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
    or coalesce(p_batch->>'adapterId','') not in ('semiconductor','mathematics','astronomy','religion','neuromorphic-biocomputing')
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') !~ '^[1-9][0-9]*$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic ingestion batch.' using errcode = '22023'; end if;

  v_count := jsonb_array_length(p_records);
  if v_count <> (p_batch->>'recordCount')::integer or v_count not between 1 and 500
  then raise exception 'Ingestion record count does not match the batch.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    return jsonb_build_object('batchId', v_existing.batch_id, 'recordCount', v_existing.record_count, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_ingestion_batches (
    batch_id, schema_version, adapter_id, adapter_version, source_dataset_version,
    source_dataset_sha256, batch_sha256, record_count, batch_snapshot,
    actor_fingerprint, idempotency_hash, ingested_at, created_at
  ) values (
    p_batch->>'batchId', p_batch->>'schemaVersion', p_batch->>'adapterId', p_batch->>'adapterVersion', p_batch->>'sourceDatasetVersion',
    p_batch->>'sourceDatasetSha256', p_batch->>'batchSha256', v_count, p_batch,
    p_actor_fingerprint, p_idempotency_hash, (p_batch->>'ingestedAt')::timestamptz, (p_batch->>'ingestedAt')::timestamptz
  );

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    if jsonb_typeof(v_record) <> 'object'
      or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
      or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
      or coalesce(v_record->>'adapterId','') <> p_batch->>'adapterId'
      or coalesce(v_record->>'ingestionRecordId','') !~ '^epirecord_[a-f0-9]{32}$'
      or char_length(coalesce(v_record->>'sourceRecordId','')) not between 3 and 180
      or coalesce(v_record->>'sourceRecordSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'sourcePublicPath','') !~ '^/knowledge/[a-z0-9/_-]+$'
      or coalesce(v_record->>'candidateRecordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(v_record->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or coalesce(v_record->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
      or jsonb_typeof(v_record->'gateDecision') <> 'object'
      or coalesce((v_record#>>'{gateDecision,publicEligible}')::boolean, false) = true
      or jsonb_typeof(v_record->'candidateSnapshot') <> 'object'
      or coalesce(v_record#>>'{candidateSnapshot,id}','') <> v_record->>'candidateRecordId'
    then raise exception 'Invalid epistemic ingestion record.' using errcode = '22023'; end if;

    insert into public.epistemic_ingestion_records (
      ingestion_record_id, batch_id, adapter_id, source_record_id, source_record_sha256,
      source_public_path, candidate_record_id, candidate_sha256, review_target_sha256,
      public_eligible, gate_decision, record_snapshot, created_at
    ) values (
      v_record->>'ingestionRecordId', p_batch->>'batchId', p_batch->>'adapterId', v_record->>'sourceRecordId', v_record->>'sourceRecordSha256',
      v_record->>'sourcePublicPath', v_record->>'candidateRecordId', v_record->>'candidateSha256', v_record->>'reviewTargetSha256',
      coalesce((v_record#>>'{gateDecision,publicEligible}')::boolean, false), v_record->'gateDecision', v_record, (p_batch->>'ingestedAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('batchId', p_batch->>'batchId', 'recordCount', v_count, 'idempotentReplay', false);
end; $$;

create or replace function public.record_epistemic_expert_review(
  p_review jsonb,
  p_profile_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_expert_review_decisions%rowtype;
  v_prior public.epistemic_expert_review_decisions%rowtype;
  v_target public.epistemic_ingestion_records%rowtype;
  v_profile public.epistemic_expert_reviewer_profiles%rowtype;
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

  select * into v_target from public.epistemic_ingestion_records
    where candidate_record_id = p_review->>'recordId' and review_target_sha256 = p_review->>'targetSha256'
    order by created_at desc limit 1;
  if not found then raise exception 'Frozen ingestion target not found.' using errcode = 'P0002'; end if;
  if coalesce(v_target.record_snapshot#>>'{candidateSnapshot,domainSlug}','') <> p_review->>'domainSlug'
  then raise exception 'Review domain does not match the frozen target.' using errcode = 'P0001'; end if;

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
    if v_prior.candidate_record_id <> p_review->>'recordId'
      or v_prior.target_sha256 <> p_review->>'targetSha256'
      or v_prior.review_scope <> p_review->>'scope'
      or v_prior.reviewer_id <> v_reviewer_id
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

revoke all on function public.record_epistemic_ingestion_batch(jsonb,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.record_epistemic_expert_review(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_ingestion_batch(jsonb,jsonb,text,text) to service_role;
grant execute on function public.record_epistemic_expert_review(jsonb,text,text,text) to service_role;

comment on table public.epistemic_ingestion_batches is 'Append-only adapter batches. Ingestion is not publication.';
comment on table public.epistemic_expert_review_decisions is 'Append-only, scope-specific expert decisions bound to frozen content hashes. No row represents product approval or empirical validation.';

notify pgrst, 'reload schema';
