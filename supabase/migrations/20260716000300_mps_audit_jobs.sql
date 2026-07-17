create extension if not exists pgcrypto;

alter table public.agent_client_credentials
  add column if not exists allowed_capabilities text[] not null default '{}'::text[];

alter table public.agent_client_credentials
  drop constraint if exists agent_client_credentials_allowed_capabilities_check;

alter table public.agent_client_credentials
  add constraint agent_client_credentials_allowed_capabilities_check check (
    allowed_capabilities <@ array['mps_audit']::text[]
  );

alter table public.agent_client_credentials
  drop constraint if exists agent_client_credentials_allowed_offer_ids_check;

alter table public.agent_client_credentials
  add constraint agent_client_credentials_allowed_offer_ids_check check (
    allowed_offer_ids <@ array['rapid-intelligence-brief', 'verified-research-brief']::text[]
  );

create or replace function public.record_agent_credential_issued()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into public.agent_credential_events (credential_id, event_type, actor_type, event_hash, metadata)
  values (
    new.public_id,
    'issued',
    'reviewer',
    'sha256:' || encode(digest(new.public_id || '|' || new.client_id || '|' || new.secret_hash || '|' || new.issued_at::text, 'sha256'), 'hex'),
    jsonb_build_object('clientId', new.client_id, 'label', new.label, 'allowedOfferIds', new.allowed_offer_ids, 'allowedCapabilities', new.allowed_capabilities, 'expiresAt', new.expires_at)
  );
  return new;
end;
$$;

create table if not exists public.agent_mps_audits (
  public_id text primary key check (public_id ~ '^audit_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  client_request_id text not null,
  input_hash text not null check (input_hash ~ '^sha256:[a-f0-9]{64}$'),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  result jsonb,
  failure_code text,
  model text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (credential_id, client_request_id),
  check (
    (status = 'processing' and result is null and failure_code is null and completed_at is null)
    or (status = 'completed' and result is not null and failure_code is null and completed_at is not null)
    or (status = 'failed' and result is null and failure_code is not null and completed_at is not null)
  )
);

create table if not exists public.agent_mps_audit_events (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null references public.agent_mps_audits(public_id) on delete cascade,
  event_type text not null check (event_type in ('accepted', 'completed', 'failed')),
  actor_type text not null check (actor_type in ('agent', 'system')),
  event_hash text not null check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.record_mps_audit_created()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into public.agent_mps_audit_events (audit_id, event_type, actor_type, event_hash, metadata)
  values (
    new.public_id,
    'accepted',
    'agent',
    new.input_hash,
    jsonb_build_object('clientId', new.client_id, 'credentialId', new.credential_id, 'clientRequestId', new.client_request_id, 'model', new.model)
  );
  insert into public.agent_credential_events (credential_id, event_type, actor_type, event_hash, metadata)
  values (
    new.credential_id,
    'used',
    'client',
    new.input_hash,
    jsonb_build_object('auditId', new.public_id, 'capability', 'mps_audit', 'clientId', new.client_id)
  );
  return new;
end;
$$;

create or replace function public.record_mps_audit_finished()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into public.agent_mps_audit_events (audit_id, event_type, actor_type, event_hash, metadata)
    values (
      new.public_id,
      'completed',
      'system',
      'sha256:' || encode(digest(new.public_id || '|' || new.status || '|' || new.result::text || '|' || new.completed_at::text, 'sha256'), 'hex'),
      jsonb_build_object('model', new.model, 'inputHash', new.input_hash)
    );
  elsif new.status = 'failed' and old.status is distinct from 'failed' then
    insert into public.agent_mps_audit_events (audit_id, event_type, actor_type, event_hash, metadata)
    values (
      new.public_id,
      'failed',
      'system',
      'sha256:' || encode(digest(new.public_id || '|' || new.status || '|' || new.failure_code || '|' || new.completed_at::text, 'sha256'), 'hex'),
      jsonb_build_object('model', new.model, 'inputHash', new.input_hash, 'failureCode', new.failure_code)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists mps_audit_created_event on public.agent_mps_audits;
create trigger mps_audit_created_event
after insert on public.agent_mps_audits
for each row execute function public.record_mps_audit_created();

drop trigger if exists mps_audit_finished_event on public.agent_mps_audits;
create trigger mps_audit_finished_event
after update of status on public.agent_mps_audits
for each row execute function public.record_mps_audit_finished();

create index if not exists agent_mps_audits_credential_created_at_idx on public.agent_mps_audits (credential_id, created_at desc);
create index if not exists agent_mps_audit_events_audit_id_created_at_idx on public.agent_mps_audit_events (audit_id, created_at asc);

alter table public.agent_mps_audits enable row level security;
alter table public.agent_mps_audit_events enable row level security;

-- No public policies: only server-side code using the Supabase service role may access audit records.
