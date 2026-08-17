-- Scoped practitioner reviews for celestial calculation conventions, source
-- fidelity, and rule formalization. Reviews are append-only and cannot express
-- aggregate product approval or empirical validation.

create table if not exists public.practitioner_reviewer_profiles (
  reviewer_id text not null check (reviewer_id ~ '^practitioner_[a-z0-9][a-z0-9_-]{6,63}$'),
  profile_version integer not null check (profile_version > 0),
  profile_sha256 text not null check (profile_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  profile_snapshot jsonb not null check (jsonb_typeof(profile_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (reviewer_id, profile_version)
);

create table if not exists public.practitioner_review_records (
  review_id text primary key check (review_id ~ '^prreview_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'practitioner-review/0.1'),
  rubric_version integer not null check (rubric_version > 0),
  scope text not null check (scope in ('calculation-conventions','source-fidelity','rule-formalization')),
  target_type text not null check (target_type in ('calculation-profile','source-passage','interpretation-rule')),
  target_id text not null check (char_length(target_id) between 3 and 160),
  target_version text not null check (char_length(target_version) between 1 and 80),
  target_sha256 text not null check (target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  reviewer_id text not null,
  reviewer_profile_version integer not null,
  verdict text not null check (verdict in ('accepted','accepted-with-reservations','revision-required','disagreed','abstained')),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) between 3 and 4),
  disagreements jsonb not null check (jsonb_typeof(disagreements) = 'array' and jsonb_array_length(disagreements) <= 20),
  rationale text not null check (char_length(rationale) between 20 and 4000),
  supersedes_review_id text unique references public.practitioner_review_records(review_id) on delete restrict,
  record_sha256 text not null unique check (record_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (reviewer_id, reviewer_profile_version) references public.practitioner_reviewer_profiles(reviewer_id, profile_version),
  check (
    (scope = 'calculation-conventions' and target_type = 'calculation-profile') or
    (scope = 'source-fidelity' and target_type = 'source-passage') or
    (scope = 'rule-formalization' and target_type = 'interpretation-rule')
  )
);

create index if not exists practitioner_reviews_target_idx on public.practitioner_review_records (scope, target_id, target_version, reviewed_at desc);
create index if not exists practitioner_reviews_reviewer_idx on public.practitioner_review_records (reviewer_id, reviewer_profile_version, reviewed_at desc);

alter table public.practitioner_reviewer_profiles enable row level security;
alter table public.practitioner_review_records enable row level security;
revoke all on table public.practitioner_reviewer_profiles, public.practitioner_review_records from public, anon, authenticated;
grant select on table public.practitioner_reviewer_profiles, public.practitioner_review_records to service_role;
revoke insert, update, delete, truncate on table public.practitioner_reviewer_profiles, public.practitioner_review_records from service_role;

create or replace function public.record_practitioner_review(
  p_record jsonb,
  p_profile_sha256 text,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.practitioner_review_records%rowtype;
  v_prior public.practitioner_review_records%rowtype;
  v_profile public.practitioner_reviewer_profiles%rowtype;
  v_reviewer jsonb := p_record->'reviewer';
  v_reviewer_id text := v_reviewer->>'reviewerId';
  v_profile_version integer;
begin
  if p_record is null or jsonb_typeof(p_record) <> 'object'
    or coalesce(p_record->>'reviewId','') !~ '^prreview_[a-f0-9]{32}$'
    or coalesce(p_record->>'schemaVersion','') <> 'practitioner-review/0.1'
    or coalesce(p_record->>'scope','') not in ('calculation-conventions','source-fidelity','rule-formalization')
    or coalesce(p_record->>'targetType','') not in ('calculation-profile','source-passage','interpretation-rule')
    or coalesce(p_record->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_record->>'recordSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_record->>'verdict','') not in ('accepted','accepted-with-reservations','revision-required','disagreed','abstained')
    or jsonb_typeof(p_record->'criteria') <> 'array'
    or jsonb_array_length(p_record->'criteria') not between 3 and 4
    or jsonb_typeof(p_record->'disagreements') <> 'array'
    or jsonb_array_length(p_record->'disagreements') > 20
    or char_length(coalesce(p_record->>'rationale','')) not between 20 and 4000
    or coalesce(p_record->>'reviewedAtUtc','') !~ 'Z$'
    or coalesce(v_reviewer_id,'') !~ '^practitioner_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(v_reviewer->>'profileVersion','') !~ '^[1-9][0-9]*$'
    or coalesce(v_reviewer->>'qualifiedForScope','false') <> 'true'
    or p_profile_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid practitioner review.' using errcode = '22023'; end if;

  if not (
    (p_record->>'scope' = 'calculation-conventions' and p_record->>'targetType' = 'calculation-profile') or
    (p_record->>'scope' = 'source-fidelity' and p_record->>'targetType' = 'source-passage') or
    (p_record->>'scope' = 'rule-formalization' and p_record->>'targetType' = 'interpretation-rule')
  ) then raise exception 'Review scope and target type do not match.' using errcode = '22023'; end if;

  select * into v_existing from public.practitioner_review_records where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('reviewId', v_existing.review_id, 'verdict', v_existing.verdict, 'idempotentReplay', true); end if;

  v_profile_version := (v_reviewer->>'profileVersion')::integer;
  insert into public.practitioner_reviewer_profiles (reviewer_id, profile_version, profile_sha256, profile_snapshot, created_at)
  values (v_reviewer_id, v_profile_version, p_profile_sha256, v_reviewer, (p_record->>'reviewedAtUtc')::timestamptz)
  on conflict (reviewer_id, profile_version) do nothing;
  select * into v_profile from public.practitioner_reviewer_profiles where reviewer_id = v_reviewer_id and profile_version = v_profile_version;
  if v_profile.profile_sha256 <> p_profile_sha256 or v_profile.profile_snapshot <> v_reviewer then
    raise exception 'Reviewer profile version already exists with different identity data.' using errcode = 'P0001';
  end if;

  if nullif(p_record->>'supersedesReviewId','') is not null then
    select * into v_prior from public.practitioner_review_records where review_id = p_record->>'supersedesReviewId';
    if not found then raise exception 'Superseded review not found.' using errcode = 'P0002'; end if;
    if v_prior.target_id <> p_record->>'targetId' or v_prior.target_version <> p_record->>'targetVersion'
      or v_prior.reviewer_id <> v_reviewer_id then
      raise exception 'A review can supersede only the same reviewer and frozen target version.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.practitioner_review_records (
    review_id, schema_version, rubric_version, scope, target_type, target_id, target_version, target_sha256,
    reviewer_id, reviewer_profile_version, verdict, criteria, disagreements, rationale, supersedes_review_id,
    record_sha256, record_snapshot, actor_fingerprint, idempotency_hash, reviewed_at, created_at
  ) values (
    p_record->>'reviewId', p_record->>'schemaVersion', (p_record->>'rubricVersion')::integer,
    p_record->>'scope', p_record->>'targetType', p_record->>'targetId', p_record->>'targetVersion', p_record->>'targetSha256',
    v_reviewer_id, v_profile_version, p_record->>'verdict', p_record->'criteria', p_record->'disagreements', p_record->>'rationale', nullif(p_record->>'supersedesReviewId',''),
    p_record->>'recordSha256', p_record, p_actor_fingerprint, p_idempotency_hash,
    (p_record->>'reviewedAtUtc')::timestamptz, (p_record->>'reviewedAtUtc')::timestamptz
  );
  return jsonb_build_object('reviewId', p_record->>'reviewId', 'verdict', p_record->>'verdict', 'idempotentReplay', false);
end; $$;

revoke all on function public.record_practitioner_review(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.record_practitioner_review(jsonb,text,text,text) to service_role;

comment on table public.practitioner_review_records is 'Append-only, scope-specific practitioner judgements. No row represents product approval, scientific validation, or predictive evidence.';
