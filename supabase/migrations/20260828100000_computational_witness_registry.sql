-- Private computational provenance registry. Immutable receipt identity is
-- separated from the purgeable payload vault so retention can be honored
-- without rewriting the provenance ledger.

create table public.computational_witness_receipts (
  tenant_id text not null check (tenant_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'),
  receipt_sha256 text not null check (receipt_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  schema_version text not null check (schema_version = 'maha-computational-witness/0.1'),
  canonicalization_version text not null check (canonicalization_version = 'maha-dossier-canonical/1.0'),
  witness_version text not null check (char_length(witness_version) between 3 and 32),
  job_id_sha256 text not null check (job_id_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  execution_status text not null check (execution_status in ('succeeded','failed')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  input_sha256 text not null check (input_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  output_sha256 text not null check (output_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  environment_sha256 text not null check (environment_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  binding_sha256 text not null check (binding_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  artifact_count integer not null check (artifact_count between 0 and 2048),
  retention_days integer not null check (retention_days between 1 and 3650),
  retained_until timestamptz not null,
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, receipt_sha256),
  check (finished_at >= started_at),
  check (retained_until > created_at)
);

create table public.computational_witness_payloads (
  tenant_id text not null,
  receipt_sha256 text not null,
  receipt_snapshot jsonb not null check (jsonb_typeof(receipt_snapshot) = 'object'),
  retained_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, receipt_sha256),
  foreign key (tenant_id, receipt_sha256)
    references public.computational_witness_receipts(tenant_id, receipt_sha256) on delete restrict,
  check (receipt_snapshot->>'receiptSha256' = receipt_sha256),
  check (retained_until > created_at)
);

create table public.computational_witness_submissions (
  tenant_id text not null,
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  request_sha256 text not null check (request_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  receipt_sha256 text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_hash),
  foreign key (tenant_id, receipt_sha256)
    references public.computational_witness_receipts(tenant_id, receipt_sha256) on delete restrict
);

create table public.computational_witness_payload_events (
  tenant_id text not null,
  receipt_sha256 text not null,
  event_type text not null check (event_type = 'payload-purged'),
  reason text not null check (reason in ('tenant-request','retention-expired')),
  occurred_at timestamptz not null,
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, receipt_sha256, event_type),
  foreign key (tenant_id, receipt_sha256)
    references public.computational_witness_receipts(tenant_id, receipt_sha256) on delete restrict
);

create index computational_witness_receipts_tenant_created_idx
  on public.computational_witness_receipts (tenant_id, created_at desc);
create index computational_witness_payloads_expiry_idx
  on public.computational_witness_payloads (retained_until, tenant_id, receipt_sha256);

create trigger computational_witness_receipts_immutable
  before update or delete on public.computational_witness_receipts
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger computational_witness_submissions_immutable
  before update or delete on public.computational_witness_submissions
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger computational_witness_payload_events_immutable
  before update or delete on public.computational_witness_payload_events
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.computational_witness_receipts enable row level security;
alter table public.computational_witness_payloads enable row level security;
alter table public.computational_witness_submissions enable row level security;
alter table public.computational_witness_payload_events enable row level security;
revoke all on table public.computational_witness_receipts, public.computational_witness_payloads,
  public.computational_witness_submissions, public.computational_witness_payload_events
  from public, anon, authenticated, service_role;

create or replace function public.record_computational_witness_receipt(
  p_tenant_id text,
  p_receipt jsonb,
  p_job_id_sha256 text,
  p_binding_sha256 text,
  p_idempotency_hash text,
  p_request_sha256 text,
  p_actor_fingerprint text,
  p_retention_days integer
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_receipt_sha text := p_receipt->>'receiptSha256';
  v_existing_submission public.computational_witness_submissions%rowtype;
  v_existing_receipt public.computational_witness_receipts%rowtype;
  v_retained_until timestamptz;
  v_inserted integer := 0;
begin
  if p_tenant_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or p_receipt is null or jsonb_typeof(p_receipt) <> 'object'
    or coalesce(p_receipt->>'schemaVersion','') <> 'maha-computational-witness/0.1'
    or coalesce(p_receipt->>'canonicalizationVersion','') <> 'maha-dossier-canonical/1.0'
    or coalesce(v_receipt_sha,'') !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_receipt->>'witnessVersion','')) not between 3 and 32
    or coalesce(p_receipt->>'inputSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_receipt->>'outputSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_receipt->>'environmentSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_receipt#>>'{execution,status}','') not in ('succeeded','failed')
    or coalesce(jsonb_typeof(p_receipt->'artifacts'),'') <> 'array'
    or jsonb_array_length(p_receipt->'artifacts') > 2048
    or p_job_id_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_binding_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_request_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
    or p_retention_days not between 1 and 3650
  then raise exception 'Invalid computational witness receipt submission.' using errcode = '22023'; end if;

  -- Serialize concurrent use of one tenant-scoped idempotency key before
  -- checking or inserting its append-only submission row.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id || ':' || p_idempotency_hash, 0));

  select * into v_existing_submission from public.computational_witness_submissions
    where tenant_id = p_tenant_id and idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing_submission.request_sha256 <> p_request_sha256
    then raise exception 'Witness idempotency key cannot cross request digests.' using errcode = 'P0001'; end if;
    select * into v_existing_receipt from public.computational_witness_receipts
      where tenant_id = p_tenant_id and receipt_sha256 = v_existing_submission.receipt_sha256;
    return jsonb_build_object('status','idempotent','receiptSha256',v_existing_receipt.receipt_sha256,
      'retainedUntil',v_existing_receipt.retained_until,'payloadAvailable',exists(
        select 1 from public.computational_witness_payloads where tenant_id=p_tenant_id and receipt_sha256=v_existing_receipt.receipt_sha256));
  end if;

  v_retained_until := now() + make_interval(days => p_retention_days);
  insert into public.computational_witness_receipts (
    tenant_id, receipt_sha256, schema_version, canonicalization_version, witness_version,
    job_id_sha256, execution_status, started_at, finished_at, input_sha256, output_sha256,
    environment_sha256, binding_sha256, artifact_count, retention_days, retained_until, actor_fingerprint
  ) values (
    p_tenant_id, v_receipt_sha, p_receipt->>'schemaVersion', p_receipt->>'canonicalizationVersion',
    p_receipt->>'witnessVersion', p_job_id_sha256, p_receipt#>>'{execution,status}',
    (p_receipt#>>'{execution,startedAt}')::timestamptz, (p_receipt#>>'{execution,finishedAt}')::timestamptz,
    p_receipt->>'inputSha256', p_receipt->>'outputSha256', p_receipt->>'environmentSha256',
    p_binding_sha256, jsonb_array_length(p_receipt->'artifacts'), p_retention_days, v_retained_until, p_actor_fingerprint
  ) on conflict (tenant_id, receipt_sha256) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.computational_witness_payloads (tenant_id, receipt_sha256, receipt_snapshot, retained_until)
      values (p_tenant_id, v_receipt_sha, p_receipt, v_retained_until);
  else
    select * into v_existing_receipt from public.computational_witness_receipts
      where tenant_id = p_tenant_id and receipt_sha256 = v_receipt_sha;
    if v_existing_receipt.retention_days <> p_retention_days
    then raise exception 'A witness receipt cannot be replayed under a different retention term.' using errcode = 'P0001'; end if;
    v_retained_until := v_existing_receipt.retained_until;
  end if;

  insert into public.computational_witness_submissions
    (tenant_id, idempotency_hash, request_sha256, receipt_sha256)
    values (p_tenant_id, p_idempotency_hash, p_request_sha256, v_receipt_sha);

  return jsonb_build_object('status',case when v_inserted > 0 then 'created' else 'replay' end,
    'receiptSha256',v_receipt_sha,'retainedUntil',v_retained_until,'payloadAvailable',(v_inserted > 0) or exists(
      select 1 from public.computational_witness_payloads where tenant_id=p_tenant_id and receipt_sha256=v_receipt_sha));
end; $$;

create or replace function public.read_computational_witness_receipt(p_tenant_id text, p_receipt_sha256 text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select case when r.receipt_sha256 is null then null else jsonb_build_object(
    'receiptSha256', r.receipt_sha256,
    'schemaVersion', r.schema_version,
    'executionStatus', r.execution_status,
    'inputSha256', r.input_sha256,
    'outputSha256', r.output_sha256,
    'environmentSha256', r.environment_sha256,
    'artifactCount', r.artifact_count,
    'retainedUntil', r.retained_until,
    'payloadAvailable', p.receipt_snapshot is not null and p.retained_until > now(),
    'receipt', case when p.retained_until > now() then p.receipt_snapshot else null end
  ) end
  from public.computational_witness_receipts r
  left join public.computational_witness_payloads p
    on p.tenant_id=r.tenant_id and p.receipt_sha256=r.receipt_sha256
  where r.tenant_id=p_tenant_id and r.receipt_sha256=p_receipt_sha256;
$$;

create or replace function public.purge_computational_witness_payload(
  p_tenant_id text, p_receipt_sha256 text, p_actor_fingerprint text, p_reason text default 'tenant-request'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_deleted integer;
begin
  if p_tenant_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' or p_receipt_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_reason not in ('tenant-request','retention-expired')
  then raise exception 'Invalid computational witness purge request.' using errcode='22023'; end if;
  delete from public.computational_witness_payloads where tenant_id=p_tenant_id and receipt_sha256=p_receipt_sha256;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    insert into public.computational_witness_payload_events
      (tenant_id,receipt_sha256,event_type,reason,occurred_at,actor_fingerprint)
      values (p_tenant_id,p_receipt_sha256,'payload-purged',p_reason,now(),p_actor_fingerprint)
      on conflict (tenant_id,receipt_sha256,event_type) do nothing;
  end if;
  return jsonb_build_object('receiptSha256',p_receipt_sha256,'payloadPurged',v_deleted > 0,
    'immutableIdentityRetained',exists(select 1 from public.computational_witness_receipts where tenant_id=p_tenant_id and receipt_sha256=p_receipt_sha256));
end; $$;

create or replace function public.purge_expired_computational_witness_payloads(p_now timestamptz, p_limit integer default 100)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v_count integer;
begin
  if p_now is null or p_limit not between 1 and 1000 then raise exception 'Invalid witness expiry purge.' using errcode='22023'; end if;
  with targets as (
    select tenant_id,receipt_sha256 from public.computational_witness_payloads
    where retained_until <= p_now order by retained_until asc limit p_limit for update skip locked
  ), deleted as (
    delete from public.computational_witness_payloads p using targets t
    where p.tenant_id=t.tenant_id and p.receipt_sha256=t.receipt_sha256
    returning p.tenant_id,p.receipt_sha256
  ), events as (
    insert into public.computational_witness_payload_events
      (tenant_id,receipt_sha256,event_type,reason,occurred_at,actor_fingerprint)
    select tenant_id,receipt_sha256,'payload-purged','retention-expired',p_now,
      'sha256:f11fe0e4bf0f314e0fbeddd9c6561f053fcab8f989e564c8ececd21cb81cf9f0' from deleted
    on conflict (tenant_id,receipt_sha256,event_type) do nothing returning 1
  ) select count(*) into v_count from deleted;
  return v_count;
end; $$;

revoke all on function public.record_computational_witness_receipt(text,jsonb,text,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.read_computational_witness_receipt(text,text) from public, anon, authenticated;
revoke all on function public.purge_computational_witness_payload(text,text,text,text) from public, anon, authenticated;
revoke all on function public.purge_expired_computational_witness_payloads(timestamptz,integer) from public, anon, authenticated;
grant execute on function public.record_computational_witness_receipt(text,jsonb,text,text,text,text,text,integer) to service_role;
grant execute on function public.read_computational_witness_receipt(text,text) to service_role;
grant execute on function public.purge_computational_witness_payload(text,text,text,text) to service_role;
grant execute on function public.purge_expired_computational_witness_payloads(timestamptz,integer) to service_role;

comment on table public.computational_witness_receipts is
  'Immutable execution identity and digests. This records provenance integrity, not scientific validity or independent reproduction.';
comment on table public.computational_witness_payloads is
  'Purgeable receipt snapshots retained only through an explicitly consented tenant retention period.';
notify pgrst, 'reload schema';
