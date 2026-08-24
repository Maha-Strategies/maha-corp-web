-- Durable execution queue for authenticated publication-factory tools.
-- Jobs can only produce immutable noncanonical draft targets. Canonical
-- releases remain in the separate release-control ledger and authority path.

create table if not exists public.epistemic_factory_jobs (
  job_id text primary key check (job_id ~ '^epifjob_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-factory-job/0.1'),
  operation text not null check (operation = 'draft-node'),
  status text not null check (status in ('queued','processing','completed','failed')),
  payload_sha256 text not null check (payload_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  job_sha256 text not null unique check (job_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  job_snapshot jsonb not null check (jsonb_typeof(job_snapshot) = 'object'),
  result_snapshot jsonb check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'object'),
  error_snapshot jsonb check (error_snapshot is null or jsonb_typeof(error_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  worker_fingerprint text check (worker_fingerprint is null or worker_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 20),
  lease_expires_at timestamptz,
  enqueued_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (job_snapshot#>>'{compilation,canonicalStatus}' = 'noncanonical-draft'),
  check ((job_snapshot#>>'{compilation,indexControl,crawlable}')::boolean = false),
  check ((job_snapshot#>>'{compilation,indexControl,sitemapEligible}')::boolean = false),
  check (job_snapshot#>>'{compilation,candidateSnapshot,publication,reviewState}' = 'draft'),
  check ((job_snapshot#>>'{compilation,candidateSnapshot,publication,requestedPublicPromotion}')::boolean = false)
);

create table if not exists public.epistemic_factory_draft_targets (
  factory_target_id text primary key check (factory_target_id ~ '^epiftarget_[a-f0-9]{32}$'),
  source_job_id text not null unique references public.epistemic_factory_jobs(job_id) on delete restrict,
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  domain_slug text not null check (domain_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 300),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  source_public_path text not null check (source_public_path ~ '^/knowledge/[a-z0-9/_-]+$'),
  candidate_sha256 text not null check (candidate_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_target_sha256 text not null check (review_target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  public_eligible boolean not null check (public_eligible = false),
  gate_decision jsonb not null check (jsonb_typeof(gate_decision) = 'object'),
  record_snapshot jsonb not null check (jsonb_typeof(record_snapshot) = 'object'),
  compilation_snapshot jsonb not null check (jsonb_typeof(compilation_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  check (record_snapshot#>>'{publication,reviewState}' = 'draft'),
  check ((record_snapshot#>>'{publication,requestedPublicPromotion}')::boolean = false),
  check (jsonb_array_length(coalesce(record_snapshot#>'{publication,reviewEvents}', '[]'::jsonb)) = 0)
);

create index if not exists epistemic_factory_jobs_queue_idx
  on public.epistemic_factory_jobs (status, enqueued_at, lease_expires_at);
create index if not exists epistemic_factory_targets_record_idx
  on public.epistemic_factory_draft_targets (candidate_record_id, created_at desc);

create trigger epistemic_factory_draft_targets_immutable
  before update or delete on public.epistemic_factory_draft_targets
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_factory_jobs enable row level security;
alter table public.epistemic_factory_draft_targets enable row level security;
revoke all on table public.epistemic_factory_jobs from public, anon, authenticated;
revoke all on table public.epistemic_factory_draft_targets from public, anon, authenticated;
grant select on table public.epistemic_factory_jobs to service_role;
grant select on table public.epistemic_factory_draft_targets to service_role;
revoke insert, update, delete, truncate on table public.epistemic_factory_jobs from service_role;
revoke insert, update, delete, truncate on table public.epistemic_factory_draft_targets from service_role;

create or replace function public.enqueue_epistemic_factory_job(
  p_job jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_factory_jobs%rowtype;
begin
  if p_job is null or jsonb_typeof(p_job) <> 'object'
    or coalesce(p_job->>'schemaVersion','') <> 'maha-epistemic-factory-job/0.1'
    or coalesce(p_job->>'jobId','') !~ '^epifjob_[a-f0-9]{32}$'
    or coalesce(p_job->>'operation','') <> 'draft-node'
    or coalesce(p_job->>'status','') <> 'queued'
    or coalesce(p_job->>'payloadSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_job->>'jobSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_job->>'enqueuedAt','') !~ 'Z$'
    or coalesce(p_job#>>'{compilation,canonicalStatus}','') <> 'noncanonical-draft'
    or coalesce(p_job#>>'{compilation,indexControl,crawlable}','') <> 'false'
    or coalesce(p_job#>>'{compilation,indexControl,sitemapEligible}','') <> 'false'
    or coalesce(p_job#>>'{compilation,candidateSnapshot,publication,reviewState}','') <> 'draft'
    or coalesce(p_job#>>'{compilation,candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
    or coalesce(jsonb_array_length(p_job#>'{compilation,candidateSnapshot,publication,reviewEvents}'), -1) <> 0
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid noncanonical factory job.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_factory_jobs where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.job_snapshot#>>'{compilation,reviewTargetSha256}' <> p_job#>>'{compilation,reviewTargetSha256}'
      or v_existing.job_snapshot#>>'{compilation,sourcePublicPath}' <> p_job#>>'{compilation,sourcePublicPath}'
    then raise exception 'Factory idempotency cannot cross candidate targets or source paths.' using errcode = 'P0001'; end if;
    return jsonb_build_object('jobId', v_existing.job_id, 'status', v_existing.status, 'idempotentReplay', true);
  end if;

  insert into public.epistemic_factory_jobs (
    job_id, schema_version, operation, status, payload_sha256, job_sha256,
    job_snapshot, actor_fingerprint, idempotency_hash, enqueued_at, updated_at
  ) values (
    p_job->>'jobId', p_job->>'schemaVersion', p_job->>'operation', 'queued',
    p_job->>'payloadSha256', p_job->>'jobSha256', p_job, p_actor_fingerprint,
    p_idempotency_hash, (p_job->>'enqueuedAt')::timestamptz, now()
  );
  return jsonb_build_object('jobId', p_job->>'jobId', 'status', 'queued', 'idempotentReplay', false);
end; $$;

create or replace function public.claim_epistemic_factory_jobs(
  p_worker_fingerprint text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
) returns setof jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_worker_fingerprint !~ '^sha256:[a-f0-9]{64}$'
    or p_limit not between 1 and 50 or p_lease_seconds not between 30 and 1800
  then raise exception 'Invalid factory worker claim.' using errcode = '22023'; end if;

  return query
  with candidates as (
    select job_id from public.epistemic_factory_jobs
    where status = 'queued' or (status = 'processing' and lease_expires_at < now())
    order by enqueued_at, job_id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.epistemic_factory_jobs as jobs set
      status = 'processing', worker_fingerprint = p_worker_fingerprint,
      attempts = jobs.attempts + 1,
      started_at = coalesce(jobs.started_at, now()),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
    from candidates where jobs.job_id = candidates.job_id
    returning jobs.job_snapshot
  ) select job_snapshot from claimed;
end; $$;

create or replace function public.complete_epistemic_factory_job(
  p_job_id text,
  p_payload_sha256 text,
  p_result jsonb,
  p_worker_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job public.epistemic_factory_jobs%rowtype;
  v_compilation jsonb;
  v_target_id text;
begin
  select * into v_job from public.epistemic_factory_jobs where job_id = p_job_id for update;
  if not found then raise exception 'Factory job not found.' using errcode = 'P0002'; end if;
  if v_job.status = 'completed' then
    return jsonb_build_object('jobId', v_job.job_id, 'status', 'completed', 'idempotentReplay', true);
  end if;
  if v_job.status <> 'processing' or v_job.worker_fingerprint <> p_worker_fingerprint
    or v_job.payload_sha256 <> p_payload_sha256
    or p_result is null or jsonb_typeof(p_result) <> 'object'
  then raise exception 'Factory completion does not match the active lease.' using errcode = 'P0001'; end if;

  v_compilation := v_job.job_snapshot->'compilation';
  if coalesce(v_compilation->>'compilationSha256','') <> v_job.payload_sha256
    or coalesce(v_compilation->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_compilation->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_compilation#>>'{automatedAudit,status}','') not in ('blocked','review-required','automated-checks-passed')
    or coalesce(v_compilation#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
    or coalesce(v_compilation#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
  then raise exception 'Factory completion payload is not a bounded draft.' using errcode = '22023'; end if;

  v_target_id := 'epiftarget_' || substr(encode(digest(v_job.job_id || ':' || v_job.payload_sha256, 'sha256'), 'hex'), 1, 32);
  insert into public.epistemic_factory_draft_targets (
    factory_target_id, source_job_id, candidate_record_id, domain_slug, title, slug,
    source_public_path, candidate_sha256, review_target_sha256, public_eligible,
    gate_decision, record_snapshot, compilation_snapshot, created_at
  ) values (
    v_target_id, v_job.job_id, v_compilation->>'recordId', v_compilation#>>'{candidateSnapshot,domainSlug}',
    v_compilation#>>'{candidateSnapshot,title}', v_compilation#>>'{candidateSnapshot,slug}',
    v_compilation->>'sourcePublicPath', v_compilation->>'candidateSha256', v_compilation->>'reviewTargetSha256',
    false, jsonb_build_object(
      'recordId', v_compilation->>'recordId',
      'publicEligible', false,
      'evaluatedAgainst', 'maha-epistemic/1.0',
      'reasons', v_compilation#>'{automatedAudit,gateReasons}'
    ), v_compilation->'candidateSnapshot', v_compilation, now()
  );

  update public.epistemic_factory_jobs set status = 'completed', result_snapshot = p_result,
    completed_at = now(), lease_expires_at = null, updated_at = now()
  where job_id = p_job_id;
  return jsonb_build_object('jobId', p_job_id, 'factoryTargetId', v_target_id, 'status', 'completed', 'idempotentReplay', false);
end; $$;

create or replace function public.fail_epistemic_factory_job(
  p_job_id text,
  p_error jsonb,
  p_worker_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_job public.epistemic_factory_jobs%rowtype;
begin
  select * into v_job from public.epistemic_factory_jobs where job_id = p_job_id for update;
  if not found then raise exception 'Factory job not found.' using errcode = 'P0002'; end if;
  if v_job.status in ('completed','failed') then
    return jsonb_build_object('jobId', v_job.job_id, 'status', v_job.status, 'idempotentReplay', true);
  end if;
  if v_job.status <> 'processing' or v_job.worker_fingerprint <> p_worker_fingerprint
    or p_error is null or jsonb_typeof(p_error) <> 'object'
  then raise exception 'Factory failure does not match the active lease.' using errcode = 'P0001'; end if;
  update public.epistemic_factory_jobs set status = 'failed', error_snapshot = p_error,
    completed_at = now(), lease_expires_at = null, updated_at = now()
  where job_id = p_job_id;
  return jsonb_build_object('jobId', p_job_id, 'status', 'failed', 'idempotentReplay', false);
end; $$;

revoke all on function public.enqueue_epistemic_factory_job(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.claim_epistemic_factory_jobs(text,integer,integer) from public, anon, authenticated;
revoke all on function public.complete_epistemic_factory_job(text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.fail_epistemic_factory_job(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.enqueue_epistemic_factory_job(jsonb,text,text) to service_role;
grant execute on function public.claim_epistemic_factory_jobs(text,integer,integer) to service_role;
grant execute on function public.complete_epistemic_factory_job(text,text,jsonb,text) to service_role;
grant execute on function public.fail_epistemic_factory_job(text,jsonb,text) to service_role;

comment on table public.epistemic_factory_jobs is 'Durable authenticated factory queue. Job state is operational and cannot express review or release approval.';
comment on table public.epistemic_factory_draft_targets is 'Immutable noncanonical factory outputs. These targets remain absent from public routes and the sitemap until separate exact-hash review and release.';

notify pgrst, 'reload schema';
