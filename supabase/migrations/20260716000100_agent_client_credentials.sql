create extension if not exists pgcrypto;

create table if not exists public.agent_clients (
  public_id text primary key check (public_id ~ '^client_[a-f0-9]{32}$'),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.agent_client_credentials (
  public_id text primary key check (public_id ~ '^cred_[a-f0-9]{32}$'),
  client_id text not null references public.agent_clients(public_id) on delete restrict,
  label text not null,
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  secret_prefix text not null,
  allowed_offer_ids text[] not null check (
    cardinality(allowed_offer_ids) > 0
    and allowed_offer_ids <@ array['rapid-intelligence-brief', 'verified-research-brief']::text[]
  ),
  rate_limit_per_hour integer not null default 12 check (rate_limit_per_hour between 1 and 100),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text
);

create table if not exists public.agent_credential_events (
  id uuid primary key default gen_random_uuid(),
  credential_id text not null references public.agent_client_credentials(public_id) on delete cascade,
  event_type text not null check (event_type in ('issued', 'revoked', 'used')),
  actor_type text not null check (actor_type in ('reviewer', 'client', 'system')),
  event_hash text not null check (event_hash ~ '^sha256:[a-f0-9]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_inquiries
  add column if not exists client_id text references public.agent_clients(public_id) on delete restrict,
  add column if not exists credential_id text references public.agent_client_credentials(public_id) on delete restrict;

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
    jsonb_build_object('clientId', new.client_id, 'label', new.label, 'allowedOfferIds', new.allowed_offer_ids, 'expiresAt', new.expires_at)
  );
  return new;
end;
$$;

create or replace function public.record_agent_credential_revoked()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    insert into public.agent_credential_events (credential_id, event_type, actor_type, event_hash, metadata)
    values (
      new.public_id,
      'revoked',
      'reviewer',
      'sha256:' || encode(digest(new.public_id || '|' || coalesce(new.revocation_reason, '') || '|' || new.revoked_at::text, 'sha256'), 'hex'),
      jsonb_build_object('reason', new.revocation_reason)
    );
  end if;
  return new;
end;
$$;

create or replace function public.record_agent_credential_use()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if new.credential_id is not null then
    insert into public.agent_credential_events (credential_id, event_type, actor_type, event_hash, metadata)
    values (
      new.credential_id,
      'used',
      'client',
      new.payload_hash,
      jsonb_build_object('inquiryId', new.public_id, 'offerId', new.offer_id, 'clientId', new.client_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists agent_credential_issued_event on public.agent_client_credentials;
create trigger agent_credential_issued_event
after insert on public.agent_client_credentials
for each row execute function public.record_agent_credential_issued();

drop trigger if exists agent_credential_revoked_event on public.agent_client_credentials;
create trigger agent_credential_revoked_event
after update of status on public.agent_client_credentials
for each row execute function public.record_agent_credential_revoked();

drop trigger if exists agent_credential_used_event on public.agent_inquiries;
create trigger agent_credential_used_event
after insert on public.agent_inquiries
for each row execute function public.record_agent_credential_use();

create index if not exists agent_client_credentials_client_id_idx on public.agent_client_credentials (client_id, issued_at desc);
create index if not exists agent_client_credentials_active_idx on public.agent_client_credentials (status, expires_at);
create index if not exists agent_credential_events_credential_id_created_at_idx on public.agent_credential_events (credential_id, created_at asc);

alter table public.agent_clients enable row level security;
alter table public.agent_client_credentials enable row level security;
alter table public.agent_credential_events enable row level security;

-- No public policies: server-side code using the service role is the only registry client.
