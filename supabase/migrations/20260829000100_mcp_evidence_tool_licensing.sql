-- Governed commercial machine access to active epistemic releases. Licensing
-- changes access and quota only; it cannot create, supersede, or withdraw a
-- canonical release and cannot weaken the publication gate.

-- Admit only the dedicated synthetic Preview adapter in addition to every
-- adapter already accepted by the immutable ingestion ledger. Reapplying this
-- migration is safe and is required for isolated Preview canary convergence.
alter table public.epistemic_ingestion_batches
  drop constraint if exists epistemic_ingestion_batches_adapter_id_check;
alter table public.epistemic_ingestion_batches
  add constraint epistemic_ingestion_batches_adapter_id_check
  check (adapter_id in (
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary'
  ));

alter table public.epistemic_ingestion_records
  drop constraint if exists epistemic_ingestion_records_adapter_id_check;
alter table public.epistemic_ingestion_records
  add constraint epistemic_ingestion_records_adapter_id_check
  check (adapter_id in (
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary'
  ));

alter table public.agent_client_credentials
  drop constraint if exists agent_client_credentials_allowed_capabilities_check;
alter table public.agent_client_credentials
  add constraint agent_client_credentials_allowed_capabilities_check check (
    allowed_capabilities <@ array['mps_audit', 'mcp_gateway', 'context_compile', 'mcp_evidence_retrieval']::text[]
  );

create table if not exists public.mcp_evidence_license_plans (
  plan_id text not null,
  plan_version text not null,
  title text not null,
  audience text not null check (audience in ('internal-evaluation','commercial-developer','commercial-enterprise')),
  allowed_tools text[] not null check (
    cardinality(allowed_tools) > 0
    and allowed_tools <@ array['evidence.retrieve_released_record']::text[]
  ),
  monthly_quota_units integer not null check (monthly_quota_units between 1 and 1000000),
  list_price_usd_cents integer check (list_price_usd_cents is null or list_price_usd_cents >= 0),
  terms_sha256 text not null check (terms_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  primary key (plan_id, plan_version)
);

insert into public.mcp_evidence_license_plans
  (plan_id, plan_version, title, audience, allowed_tools, monthly_quota_units, list_price_usd_cents, terms_sha256)
values
  ('evidence-internal-canary-v1','1.0.0','Internal evidence retrieval canary','internal-evaluation',array['evidence.retrieve_released_record'],25,0,'sha256:5c50f6b36dd890ff4d115c22fd0279df19bfba040d8695942aa7ab24c5085c7b'),
  ('evidence-developer-v1','1.0.0','Developer evidence retrieval','commercial-developer',array['evidence.retrieve_released_record'],10000,125000,'sha256:5c50f6b36dd890ff4d115c22fd0279df19bfba040d8695942aa7ab24c5085c7b'),
  ('evidence-enterprise-v1','1.0.0','Enterprise evidence retrieval','commercial-enterprise',array['evidence.retrieve_released_record'],100000,null,'sha256:5c50f6b36dd890ff4d115c22fd0279df19bfba040d8695942aa7ab24c5085c7b')
on conflict (plan_id, plan_version) do nothing;

create table if not exists public.mcp_evidence_license_grants (
  grant_id text primary key check (grant_id ~ '^mcpgrant_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-mcp-evidence-license/1.0'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  plan_id text not null,
  plan_version text not null,
  allowed_tools text[] not null,
  monthly_quota_units integer not null check (monthly_quota_units > 0),
  valid_from timestamptz not null,
  valid_until timestamptz not null check (valid_until > valid_from),
  consideration_state text not null check (consideration_state in ('internal-evaluation','externally-contracted')),
  contracted_amount_usd_cents integer not null check (contracted_amount_usd_cents >= 0),
  received_amount_usd_cents integer not null check (received_amount_usd_cents between 0 and contracted_amount_usd_cents),
  commercial_reference text,
  terms_sha256 text not null check (terms_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  grant_sha256 text not null unique check (grant_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  grant_snapshot jsonb not null check (jsonb_typeof(grant_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_sha256 text not null unique check (idempotency_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (plan_id, plan_version) references public.mcp_evidence_license_plans(plan_id, plan_version),
  check (
    (consideration_state = 'internal-evaluation' and contracted_amount_usd_cents = 0 and received_amount_usd_cents = 0 and commercial_reference is null)
    or (consideration_state = 'externally-contracted' and commercial_reference is not null)
  )
);

create table if not exists public.mcp_evidence_license_events (
  event_id uuid primary key default gen_random_uuid(),
  grant_id text not null references public.mcp_evidence_license_grants(grant_id) on delete restrict,
  event_type text not null check (event_type in ('granted','revoked')),
  reason text,
  event_sha256 text not null unique check (event_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_sha256 text not null unique check (idempotency_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (grant_id, event_type)
);

create table if not exists public.mcp_evidence_executions (
  execution_id text primary key check (execution_id ~ '^mcpexe_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-mcp-evidence-execution/1.0'),
  grant_id text not null references public.mcp_evidence_license_grants(grant_id) on delete restrict,
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  plan_id text not null,
  plan_version text not null,
  client_request_id text not null check (client_request_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$'),
  request_sha256 text not null check (request_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  tool_name text not null check (tool_name = 'evidence.retrieve_released_record'),
  release_id text not null references public.epistemic_canonical_releases(release_id) on delete restrict,
  release_sha256 text not null check (release_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  quota_period_started_at timestamptz not null,
  unit_quantity integer not null default 1 check (unit_quantity = 1),
  reserved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (credential_id, client_request_id),
  foreign key (plan_id, plan_version) references public.mcp_evidence_license_plans(plan_id, plan_version)
);

create table if not exists public.mcp_evidence_execution_events (
  event_id uuid primary key default gen_random_uuid(),
  execution_id text not null references public.mcp_evidence_executions(execution_id) on delete restrict,
  event_type text not null check (event_type in ('reserved','completed','failed')),
  output_sha256 text check (output_sha256 is null or output_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  event_sha256 text not null unique check (event_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (execution_id, event_type),
  check (
    (event_type = 'completed' and output_sha256 is not null and failure_code is null)
    or (event_type = 'failed' and output_sha256 is null and failure_code is not null)
    or (event_type = 'reserved' and output_sha256 is null and failure_code is null)
  )
);

create index if not exists mcp_evidence_grants_credential_validity_idx
  on public.mcp_evidence_license_grants (credential_id, valid_from, valid_until);
create index if not exists mcp_evidence_executions_grant_period_idx
  on public.mcp_evidence_executions (grant_id, quota_period_started_at, reserved_at);
create index if not exists mcp_evidence_executions_release_idx
  on public.mcp_evidence_executions (release_id, reserved_at desc);

create or replace function public.reject_mcp_evidence_ledger_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'MCP evidence licensing and execution ledgers are append-only.' using errcode = '55000';
end; $$;

drop trigger if exists mcp_evidence_license_plans_immutable on public.mcp_evidence_license_plans;
drop trigger if exists mcp_evidence_license_grants_immutable on public.mcp_evidence_license_grants;
drop trigger if exists mcp_evidence_license_events_immutable on public.mcp_evidence_license_events;
drop trigger if exists mcp_evidence_executions_immutable on public.mcp_evidence_executions;
drop trigger if exists mcp_evidence_execution_events_immutable on public.mcp_evidence_execution_events;

create trigger mcp_evidence_license_plans_immutable before update or delete on public.mcp_evidence_license_plans
  for each row execute function public.reject_mcp_evidence_ledger_mutation();
create trigger mcp_evidence_license_grants_immutable before update or delete on public.mcp_evidence_license_grants
  for each row execute function public.reject_mcp_evidence_ledger_mutation();
create trigger mcp_evidence_license_events_immutable before update or delete on public.mcp_evidence_license_events
  for each row execute function public.reject_mcp_evidence_ledger_mutation();
create trigger mcp_evidence_executions_immutable before update or delete on public.mcp_evidence_executions
  for each row execute function public.reject_mcp_evidence_ledger_mutation();
create trigger mcp_evidence_execution_events_immutable before update or delete on public.mcp_evidence_execution_events
  for each row execute function public.reject_mcp_evidence_ledger_mutation();

alter table public.mcp_evidence_license_plans enable row level security;
alter table public.mcp_evidence_license_grants enable row level security;
alter table public.mcp_evidence_license_events enable row level security;
alter table public.mcp_evidence_executions enable row level security;
alter table public.mcp_evidence_execution_events enable row level security;

revoke all on public.mcp_evidence_license_plans, public.mcp_evidence_license_grants,
  public.mcp_evidence_license_events, public.mcp_evidence_executions,
  public.mcp_evidence_execution_events from public, anon, authenticated;
grant select on public.mcp_evidence_license_plans, public.mcp_evidence_license_grants,
  public.mcp_evidence_license_events, public.mcp_evidence_executions,
  public.mcp_evidence_execution_events to service_role;
revoke insert, update, delete, truncate on public.mcp_evidence_license_plans,
  public.mcp_evidence_license_grants, public.mcp_evidence_license_events,
  public.mcp_evidence_executions, public.mcp_evidence_execution_events from service_role;

create or replace function public.record_mcp_evidence_license_grant(
  p_grant jsonb,
  p_idempotency_sha256 text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plan public.mcp_evidence_license_plans%rowtype;
  v_credential public.agent_client_credentials%rowtype;
  v_existing public.mcp_evidence_license_grants%rowtype;
begin
  if p_grant is null or jsonb_typeof(p_grant) <> 'object'
    or coalesce(p_grant->>'schemaVersion','') <> 'maha-mcp-evidence-license/1.0'
    or coalesce(p_grant->>'grantId','') !~ '^mcpgrant_[a-f0-9]{32}$'
    or coalesce(p_grant->>'clientId','') !~ '^client_[a-f0-9]{32}$'
    or coalesce(p_grant->>'credentialId','') !~ '^cred_[a-f0-9]{32}$'
    or coalesce(p_grant->>'grantSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_grant->>'termsSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid MCP evidence license grant.' using errcode = '22023'; end if;

  select * into v_existing from public.mcp_evidence_license_grants where idempotency_sha256 = p_idempotency_sha256;
  if found then
    if v_existing.grant_sha256 <> p_grant->>'grantSha256' then raise exception 'License grant idempotency conflict.' using errcode = '23505'; end if;
    return jsonb_build_object('grantId',v_existing.grant_id,'idempotentReplay',true);
  end if;

  select * into v_plan from public.mcp_evidence_license_plans
    where plan_id = p_grant->>'planId' and plan_version = p_grant->>'planVersion' and status = 'active';
  if not found then raise exception 'MCP evidence license plan is unavailable.' using errcode = 'P0002'; end if;
  select * into v_credential from public.agent_client_credentials where public_id = p_grant->>'credentialId';
  if not found or v_credential.client_id <> p_grant->>'clientId' or v_credential.status <> 'active'
    or not ('mcp_evidence_retrieval' = any(v_credential.allowed_capabilities))
  then raise exception 'Credential is not eligible for MCP evidence retrieval.' using errcode = 'P0001'; end if;
  if (select array_agg(value order by value) from jsonb_array_elements_text(p_grant->'allowedTools'))
      is distinct from (select array_agg(value order by value) from unnest(v_plan.allowed_tools) value)
    or (p_grant->>'monthlyQuotaUnits')::integer <> v_plan.monthly_quota_units
    or p_grant->>'termsSha256' <> v_plan.terms_sha256
  then raise exception 'License grant differs from its immutable plan.' using errcode = 'P0001'; end if;

  insert into public.mcp_evidence_license_grants (
    grant_id,schema_version,client_id,credential_id,plan_id,plan_version,allowed_tools,monthly_quota_units,
    valid_from,valid_until,consideration_state,contracted_amount_usd_cents,received_amount_usd_cents,
    commercial_reference,terms_sha256,grant_sha256,grant_snapshot,actor_fingerprint,idempotency_sha256,issued_at
  ) values (
    p_grant->>'grantId',p_grant->>'schemaVersion',p_grant->>'clientId',p_grant->>'credentialId',p_grant->>'planId',p_grant->>'planVersion',
    array(select jsonb_array_elements_text(p_grant->'allowedTools')),(p_grant->>'monthlyQuotaUnits')::integer,
    (p_grant->>'validFrom')::timestamptz,(p_grant->>'validUntil')::timestamptz,p_grant->>'considerationState',
    (p_grant->>'contractedAmountUsdCents')::integer,(p_grant->>'receivedAmountUsdCents')::integer,p_grant->>'commercialReference',
    p_grant->>'termsSha256',p_grant->>'grantSha256',p_grant,p_actor_fingerprint,p_idempotency_sha256,(p_grant->>'issuedAt')::timestamptz
  );
  insert into public.mcp_evidence_license_events
    (grant_id,event_type,event_sha256,actor_fingerprint,idempotency_sha256,occurred_at)
  values (p_grant->>'grantId','granted',p_grant->>'grantSha256',p_actor_fingerprint,p_idempotency_sha256,(p_grant->>'issuedAt')::timestamptz);
  return jsonb_build_object('grantId',p_grant->>'grantId','idempotentReplay',false);
end; $$;

create or replace function public.revoke_mcp_evidence_license_grant(
  p_grant_id text,
  p_reason text,
  p_revoked_at timestamptz,
  p_idempotency_sha256 text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.mcp_evidence_license_events%rowtype;
begin
  if p_grant_id !~ '^mcpgrant_[a-f0-9]{32}$' or char_length(trim(p_reason)) not between 20 and 1000
    or p_revoked_at is null or p_idempotency_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid MCP evidence license revocation.' using errcode = '22023'; end if;
  select * into v_existing from public.mcp_evidence_license_events where idempotency_sha256 = p_idempotency_sha256;
  if found then
    if v_existing.grant_id <> p_grant_id or v_existing.event_type <> 'revoked' then raise exception 'License revocation idempotency conflict.' using errcode = '23505'; end if;
    return jsonb_build_object('grantId',p_grant_id,'idempotentReplay',true);
  end if;
  if not exists (select 1 from public.mcp_evidence_license_grants where grant_id = p_grant_id)
  then raise exception 'MCP evidence license grant not found.' using errcode = 'P0002'; end if;
  insert into public.mcp_evidence_license_events
    (grant_id,event_type,reason,event_sha256,actor_fingerprint,idempotency_sha256,occurred_at)
  values (p_grant_id,'revoked',trim(p_reason),'sha256:' || encode(digest(p_grant_id || '|' || trim(p_reason) || '|' || p_revoked_at::text,'sha256'),'hex'),p_actor_fingerprint,p_idempotency_sha256,p_revoked_at);
  return jsonb_build_object('grantId',p_grant_id,'idempotentReplay',false);
end; $$;

create or replace function public.reserve_mcp_evidence_execution(
  p_execution_id text,
  p_client_id text,
  p_credential_id text,
  p_client_request_id text,
  p_request_sha256 text,
  p_tool_name text,
  p_release_id text,
  p_release_sha256 text,
  p_observed_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_grant public.mcp_evidence_license_grants%rowtype;
  v_existing public.mcp_evidence_executions%rowtype;
  v_period timestamptz;
  v_used bigint;
begin
  if p_execution_id !~ '^mcpexe_[a-f0-9]{32}$' or p_client_id !~ '^client_[a-f0-9]{32}$'
    or p_credential_id !~ '^cred_[a-f0-9]{32}$' or p_client_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$'
    or p_request_sha256 !~ '^sha256:[a-f0-9]{64}$' or p_tool_name <> 'evidence.retrieve_released_record'
    or p_release_id !~ '^epirelease_[a-f0-9]{32}$' or p_release_sha256 !~ '^sha256:[a-f0-9]{64}$' or p_observed_at is null
  then raise exception 'Invalid MCP evidence execution request.' using errcode = '22023'; end if;

  if not exists (
    select 1 from public.epistemic_canonical_releases release
    where release.release_id = p_release_id and release.release_sha256 = p_release_sha256
      and not exists (select 1 from public.epistemic_canonical_releases child where child.supersedes_release_id = release.release_id)
      and not exists (select 1 from public.epistemic_release_withdrawals withdrawal where withdrawal.release_id = release.release_id)
  ) then return jsonb_build_object('outcome','release_unavailable'); end if;

  select * into v_existing from public.mcp_evidence_executions
    where credential_id = p_credential_id and client_request_id = p_client_request_id;
  if found then
    if v_existing.request_sha256 <> p_request_sha256 or v_existing.tool_name <> p_tool_name
      or v_existing.release_id <> p_release_id or v_existing.release_sha256 <> p_release_sha256
    then return jsonb_build_object('outcome','idempotency_conflict'); end if;
    if not exists (
      select 1 from public.mcp_evidence_license_grants license_grant
      join public.mcp_evidence_license_plans plan on plan.plan_id=license_grant.plan_id and plan.plan_version=license_grant.plan_version
      join public.agent_client_credentials credential on credential.public_id=license_grant.credential_id
      join public.agent_clients client on client.public_id=license_grant.client_id
      where license_grant.grant_id=v_existing.grant_id and license_grant.client_id=p_client_id and license_grant.credential_id=p_credential_id
        and p_observed_at >= license_grant.valid_from and p_observed_at < license_grant.valid_until and plan.status='active'
        and credential.status='active' and client.status='active' and p_observed_at < credential.expires_at
        and not exists (select 1 from public.mcp_evidence_license_events event where event.grant_id=license_grant.grant_id and event.event_type='revoked')
    ) then return jsonb_build_object('outcome','license_required'); end if;
    if exists (select 1 from public.mcp_evidence_execution_events where execution_id=v_existing.execution_id and event_type='failed')
    then return jsonb_build_object('outcome','execution_failed'); end if;
    return jsonb_build_object('outcome','idempotent_replay','executionId',v_existing.execution_id,'grantId',v_existing.grant_id,
      'planId',v_existing.plan_id,'planVersion',v_existing.plan_version,'quotaPeriodStartedAt',v_existing.quota_period_started_at);
  end if;

  select license_grant.* into v_grant from public.mcp_evidence_license_grants license_grant
  join public.mcp_evidence_license_plans plan on plan.plan_id=license_grant.plan_id and plan.plan_version=license_grant.plan_version
  join public.agent_client_credentials credential on credential.public_id=license_grant.credential_id
  join public.agent_clients client on client.public_id=license_grant.client_id
  where license_grant.client_id=p_client_id and license_grant.credential_id=p_credential_id
    and p_observed_at >= license_grant.valid_from and p_observed_at < license_grant.valid_until
    and p_tool_name=any(license_grant.allowed_tools) and plan.status='active'
    and credential.status='active' and client.status='active'
    and p_observed_at < credential.expires_at
    and not exists (select 1 from public.mcp_evidence_license_events event where event.grant_id=license_grant.grant_id and event.event_type='revoked')
  order by license_grant.valid_until desc, license_grant.issued_at desc limit 1 for update of license_grant;
  if not found then return jsonb_build_object('outcome','license_required'); end if;

  v_period := date_trunc('month',p_observed_at at time zone 'UTC') at time zone 'UTC';
  select coalesce(sum(execution.unit_quantity),0) into v_used
    from public.mcp_evidence_executions execution
    where execution.grant_id=v_grant.grant_id and execution.quota_period_started_at=v_period
      and not exists (select 1 from public.mcp_evidence_execution_events event where event.execution_id=execution.execution_id and event.event_type='failed');
  if v_used + 1 > v_grant.monthly_quota_units then return jsonb_build_object('outcome','quota_exhausted'); end if;

  insert into public.mcp_evidence_executions
    (execution_id,schema_version,grant_id,client_id,credential_id,plan_id,plan_version,client_request_id,request_sha256,
     tool_name,release_id,release_sha256,quota_period_started_at,unit_quantity,reserved_at)
  values (p_execution_id,'maha-mcp-evidence-execution/1.0',v_grant.grant_id,p_client_id,p_credential_id,v_grant.plan_id,v_grant.plan_version,
    p_client_request_id,p_request_sha256,p_tool_name,p_release_id,p_release_sha256,v_period,1,p_observed_at);
  insert into public.mcp_evidence_execution_events
    (execution_id,event_type,event_sha256,occurred_at)
  values (p_execution_id,'reserved','sha256:' || encode(digest(p_execution_id || '|reserved|' || p_request_sha256,'sha256'),'hex'),p_observed_at);
  return jsonb_build_object('outcome','reserved','executionId',p_execution_id,'grantId',v_grant.grant_id,
    'planId',v_grant.plan_id,'planVersion',v_grant.plan_version,'quotaPeriodStartedAt',v_period);
end; $$;

create or replace function public.complete_mcp_evidence_execution(
  p_execution_id text,
  p_output_sha256 text,
  p_event_sha256 text,
  p_completed_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing public.mcp_evidence_execution_events%rowtype;
begin
  if p_execution_id !~ '^mcpexe_[a-f0-9]{32}$' or p_output_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_event_sha256 !~ '^sha256:[a-f0-9]{64}$' or p_completed_at is null
  then raise exception 'Invalid MCP evidence completion.' using errcode='22023'; end if;
  if exists (select 1 from public.mcp_evidence_execution_events where execution_id=p_execution_id and event_type='failed')
  then raise exception 'A failed execution cannot be completed.' using errcode='P0001'; end if;
  select * into v_existing from public.mcp_evidence_execution_events where execution_id=p_execution_id and event_type='completed';
  if found then
    if v_existing.output_sha256 <> p_output_sha256 then raise exception 'Execution completion digest conflict.' using errcode='23505'; end if;
    return jsonb_build_object('outcome','idempotent_replay');
  end if;
  insert into public.mcp_evidence_execution_events (execution_id,event_type,output_sha256,event_sha256,occurred_at)
    values (p_execution_id,'completed',p_output_sha256,p_event_sha256,p_completed_at);
  return jsonb_build_object('outcome','completed');
end; $$;

create or replace function public.fail_mcp_evidence_execution(
  p_execution_id text,
  p_failure_code text,
  p_event_sha256 text,
  p_failed_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing public.mcp_evidence_execution_events%rowtype;
begin
  if p_execution_id !~ '^mcpexe_[a-f0-9]{32}$' or p_failure_code !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
    or p_event_sha256 !~ '^sha256:[a-f0-9]{64}$' or p_failed_at is null
  then raise exception 'Invalid MCP evidence failure.' using errcode='22023'; end if;
  if exists (select 1 from public.mcp_evidence_execution_events where execution_id=p_execution_id and event_type='completed')
  then raise exception 'A completed execution cannot be failed.' using errcode='P0001'; end if;
  select * into v_existing from public.mcp_evidence_execution_events where execution_id=p_execution_id and event_type='failed';
  if found then
    if v_existing.failure_code <> p_failure_code then raise exception 'Execution failure conflict.' using errcode='23505'; end if;
    return jsonb_build_object('outcome','idempotent_replay');
  end if;
  insert into public.mcp_evidence_execution_events (execution_id,event_type,failure_code,event_sha256,occurred_at)
    values (p_execution_id,'failed',p_failure_code,p_event_sha256,p_failed_at);
  return jsonb_build_object('outcome','failed');
end; $$;

revoke all on function public.record_mcp_evidence_license_grant(jsonb,text,text) from public,anon,authenticated;
revoke all on function public.revoke_mcp_evidence_license_grant(text,text,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.reserve_mcp_evidence_execution(text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.complete_mcp_evidence_execution(text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.fail_mcp_evidence_execution(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_mcp_evidence_license_grant(jsonb,text,text) to service_role;
grant execute on function public.revoke_mcp_evidence_license_grant(text,text,timestamptz,text,text) to service_role;
grant execute on function public.reserve_mcp_evidence_execution(text,text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.complete_mcp_evidence_execution(text,text,text,timestamptz) to service_role;
grant execute on function public.fail_mcp_evidence_execution(text,text,text,timestamptz) to service_role;

alter table public.commercial_api_usage_daily drop constraint if exists commercial_api_usage_daily_operation_check;
alter table public.commercial_api_usage_daily drop constraint if exists commercial_api_usage_daily_endpoint_check;
alter table public.commercial_api_usage_daily add constraint commercial_api_usage_daily_operation_check
  check (operation in ('mps_audit','mps_credit_balance','book_entitlement','book_content','mcp_evidence_retrieval'));
alter table public.commercial_api_usage_daily add constraint commercial_api_usage_daily_endpoint_check
  check (endpoint in ('/api/mps-audits','/api/mps-credits','/api/books/[id]/entitlement','/api/books/[id]/content','/api/mcp/evidence'));

create or replace function public.record_commercial_api_usage(
  p_credential_id text, p_operation text, p_endpoint text, p_method text,
  p_status_code integer, p_unit_quantity numeric, p_observed_at timestamptz
) returns text language plpgsql security definer set search_path = public as $$
declare v_status_class smallint;
begin
  if p_credential_id !~ '^cred_[a-f0-9]{32}$'
    or p_operation not in ('mps_audit','mps_credit_balance','book_entitlement','book_content','mcp_evidence_retrieval')
    or p_endpoint not in ('/api/mps-audits','/api/mps-credits','/api/books/[id]/entitlement','/api/books/[id]/content','/api/mcp/evidence')
    or p_method not in ('GET','POST') or p_status_code not between 200 and 599
    or p_unit_quantity < 0 or p_unit_quantity > 1000000 or p_observed_at is null
  then raise exception 'Invalid commercial API usage measurement.' using errcode='22023'; end if;
  v_status_class := floor(p_status_code/100)::smallint;
  insert into public.commercial_api_usage_daily
    (usage_day,credential_id,operation,endpoint,method,status_class,request_count,unit_quantity,last_observed_at)
  values ((p_observed_at at time zone 'UTC')::date,p_credential_id,p_operation,p_endpoint,p_method,v_status_class,1,p_unit_quantity,p_observed_at)
  on conflict (usage_day,credential_id,operation,status_class) do update
    set request_count=public.commercial_api_usage_daily.request_count+1,
        unit_quantity=public.commercial_api_usage_daily.unit_quantity+excluded.unit_quantity,
        last_observed_at=greatest(public.commercial_api_usage_daily.last_observed_at,excluded.last_observed_at);
  return 'recorded';
end; $$;

revoke all on function public.record_commercial_api_usage(text,text,text,text,integer,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.record_commercial_api_usage(text,text,text,text,integer,numeric,timestamptz) to service_role;

-- Freeze exactly one explicitly synthetic, Preview-only canary target. This
-- function can create neither review decisions nor a canonical release.
create or replace function public.record_mcp_private_canary_target(
  p_batch jsonb, p_records jsonb, p_idempotency_hash text, p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.epistemic_ingestion_batches%rowtype; v_record jsonb;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
    or p_records is null or jsonb_typeof(p_records) <> 'array'
    or coalesce(p_batch->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
    or coalesce(p_batch->>'batchId','') !~ '^epibatch_[a-f0-9]{32}$'
    or coalesce(p_batch->>'adapterId','') <> 'mcp-private-canary'
    or coalesce(p_batch->>'adapterVersion','') <> 'maha-epistemic-adapter/1.0'
    or coalesce(p_batch->>'sourceDatasetVersion','') <> 'maha-synthetic-private-mcp-release/1.0'
    or coalesce(p_batch->>'sourceDatasetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'batchSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_batch->>'ingestedAt','') !~ 'Z$'
    or coalesce(p_batch->>'recordCount','') <> '1'
    or jsonb_array_length(p_records) <> 1 or jsonb_array_length(p_batch#>'{records}') <> 1
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid synthetic private MCP canary target batch.' using errcode = '22023'; end if;
  select * into v_existing from public.epistemic_ingestion_batches where idempotency_hash = p_idempotency_hash;
  if found then
    if v_existing.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256' or v_existing.batch_sha256 <> p_batch->>'batchSha256'
    then raise exception 'Synthetic private MCP canary idempotency cannot cross revisions.' using errcode = 'P0001'; end if;
    return jsonb_build_object('batchId',v_existing.batch_id,'recordCount',v_existing.record_count,'idempotentReplay',true);
  end if;
  v_record := p_records->0;
  if jsonb_typeof(v_record) <> 'object'
    or coalesce(v_record->>'schemaVersion','') <> 'maha-epistemic-ingestion/1.0'
    or coalesce(v_record->>'batchId','') <> p_batch->>'batchId'
    or coalesce(v_record->>'adapterId','') <> 'mcp-private-canary'
    or coalesce(v_record->>'ingestionRecordId','') !~ '^epirecord_[a-f0-9]{32}$'
    or coalesce(v_record->>'sourceRecordId','') <> 'urn:maha:record:synthetic-private-mcp-release-fixture'
    or coalesce(v_record->>'sourceRecordSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_record->>'sourcePublicPath','') <> '/knowledge/agentic-systems-mcp/methods/synthetic-private-mcp-release-fixture'
    or coalesce(v_record->>'candidateRecordId','') <> v_record->>'sourceRecordId'
    or coalesce(v_record->>'candidateSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_record->>'reviewTargetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(v_record#>>'{gateDecision,publicEligible}','false') <> 'false'
    or coalesce(v_record#>>'{alignmentDecision,contentInspectionState}','') <> 'internally-inspected-synthetic'
    or coalesce(v_record#>>'{alignmentDecision,explanatoryEligible}','false') <> 'true'
    or coalesce(v_record#>>'{alignmentDecision,canonicalEligible}','false') <> 'true'
    or jsonb_array_length(coalesce(v_record#>'{alignmentDecision,blockerCodes}','[]'::jsonb)) <> 0
    or coalesce(v_record#>>'{alignmentDecision,inspectionAttestationSha256}','') <> 'sha256:8fabc92268a250186d8520745dda3f5336a60e327248f60f8846da97bd123a93'
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(v_record#>'{gateDecision,reasons}','[]'::jsonb)) reason
      where reason like 'source-content-inspection-missing:%'
    )
    or coalesce(v_record#>>'{candidateSnapshot,id}','') <> v_record->>'candidateRecordId'
    or coalesce(v_record#>>'{candidateSnapshot,title}','') <> 'Synthetic private MCP release fixture'
    or coalesce(v_record#>>'{candidateSnapshot,publication,reviewState}','') <> 'draft'
    or coalesce(v_record#>>'{candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'
  then raise exception 'Invalid synthetic private MCP canary target.' using errcode = '22023'; end if;
  insert into public.epistemic_ingestion_batches (batch_id,schema_version,adapter_id,adapter_version,source_dataset_version,source_dataset_sha256,batch_sha256,record_count,batch_snapshot,actor_fingerprint,idempotency_hash,ingested_at,created_at)
  values (p_batch->>'batchId',p_batch->>'schemaVersion','mcp-private-canary',p_batch->>'adapterVersion',p_batch->>'sourceDatasetVersion',p_batch->>'sourceDatasetSha256',p_batch->>'batchSha256',1,p_batch,p_actor_fingerprint,p_idempotency_hash,(p_batch->>'ingestedAt')::timestamptz,now());
  insert into public.epistemic_ingestion_records (ingestion_record_id,batch_id,adapter_id,source_record_id,source_record_sha256,source_public_path,candidate_record_id,candidate_sha256,review_target_sha256,public_eligible,gate_decision,record_snapshot,created_at)
  values (v_record->>'ingestionRecordId',p_batch->>'batchId','mcp-private-canary',v_record->>'sourceRecordId',v_record->>'sourceRecordSha256',v_record->>'sourcePublicPath',v_record->>'candidateRecordId',v_record->>'candidateSha256',v_record->>'reviewTargetSha256',false,v_record->'gateDecision',v_record,(p_batch->>'ingestedAt')::timestamptz);
  return jsonb_build_object('batchId',p_batch->>'batchId','recordCount',1,'idempotentReplay',false);
end; $$;
revoke all on function public.record_mcp_private_canary_target(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.record_mcp_private_canary_target(jsonb,jsonb,text,text) to service_role;
comment on function public.record_mcp_private_canary_target(jsonb,jsonb,text,text) is 'Persists only one explicitly synthetic Preview-only MCP canary record as a draft review target; it cannot review or release it.';

comment on table public.mcp_evidence_license_grants is 'Immutable machine evidence access grants. A grant changes access only and is not evidence of payment, truth, review, or release.';
comment on table public.mcp_evidence_executions is 'Replay-safe quota reservations binding one credential request to one exact active canonical release digest.';
