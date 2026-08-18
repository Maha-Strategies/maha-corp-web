-- Maha Celestial enterprise control plane. All customer data is tenant-scoped;
-- saved report payloads are application-encrypted before reaching Postgres.

create table if not exists public.celestial_organizations (
  organization_id text primary key check (organization_id ~ '^tenant_[a-z0-9_-]{8,120}$'),
  display_name text not null check (char_length(display_name) between 2 and 160),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  plan text not null default 'enterprise' check (plan in ('practitioner','platform','enterprise')),
  default_retention_days integer not null default 30 check (default_retention_days between 0 and 3650),
  created_at timestamptz not null default now()
);

create table if not exists public.celestial_organization_members (
  member_id text primary key check (member_id ~ '^member_[a-z0-9]{16,64}$'),
  organization_id text not null references public.celestial_organizations(organization_id),
  api_key_id text not null,
  identity_subject_sha256 text not null check (identity_subject_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  role text not null check (role in ('owner','admin','developer','reviewer','auditor','billing')),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  unique (organization_id, api_key_id)
);

create table if not exists public.celestial_interpretation_packs (
  pack_id text not null,
  version text not null,
  pack_sha256 text not null check (pack_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  status text not null check (status in ('active','deprecated','withdrawn')),
  manifest jsonb not null,
  published_at timestamptz not null,
  primary key (pack_id, version),
  unique (pack_sha256)
);
insert into public.celestial_interpretation_packs(pack_id, version, pack_sha256, status, manifest, published_at) values
  ('facts-only','1.0.0','sha256:974459b74890261bb3c3db8f7da9d530d54236c4ae6a71ddb89c0d4470a021d8','active','{"packId":"facts-only","version":"1.0.0","status":"active","reportTypes":["individual-birth","corporate-event"],"traditionIds":[],"description":"Calculated chart, calendrical facts, conventions, uncertainty, and provenance without interpretation."}'::jsonb,'2026-08-17T00:00:00Z'),
  ('jyotisha-source-bound','1.0.0','sha256:30aab39de1788b17ca9d997e56031d57042578afbb6cd76bdb2a4c39df3e9825','active','{"packId":"jyotisha-source-bound","version":"1.0.0","status":"active","reportTypes":["individual-birth","corporate-event"],"traditionIds":["vedic-jyotisha"],"description":"Review-gated Jyotiṣa modules only; unavailable rules remain visibly withheld."}'::jsonb,'2026-08-17T00:00:00Z'),
  ('comparative-natal','1.0.0','sha256:9dccad1f31cc0d03d886f71e2ca482b88a66741dbe1a9a8cd4d4c3138e007a88','active','{"packId":"comparative-natal","version":"1.0.0","status":"active","reportTypes":["individual-birth"],"traditionIds":["vedic-jyotisha","hellenistic-ptolemaic"],"description":"Separate, non-synthesized natal outputs from two named traditions."}'::jsonb,'2026-08-17T00:00:00Z')
on conflict (pack_id, version) do nothing;

create table if not exists public.celestial_organization_packs (
  organization_id text not null references public.celestial_organizations(organization_id),
  pack_id text not null,
  version text not null,
  installed_by_member_id text not null references public.celestial_organization_members(member_id),
  installed_at timestamptz not null default now(),
  primary key (organization_id, pack_id),
  foreign key (pack_id, version) references public.celestial_interpretation_packs(pack_id, version)
);

create table if not exists public.celestial_enterprise_reports (
  report_id text primary key check (report_id ~ '^celrep_[a-f0-9]{24}$'),
  organization_id text not null references public.celestial_organizations(organization_id),
  client_request_id text not null,
  report_type text not null check (report_type in ('individual-birth','corporate-event')),
  pack_id text not null,
  pack_version text not null,
  consent_policy_version text not null,
  consent_basis text not null check (consent_basis in ('explicit-subject-consent','authorized-organizational-record','public-record')),
  consent_reference_sha256 text not null check (consent_reference_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  request_sha256 text not null check (request_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  result_sha256 text not null check (result_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  encrypted_payload text,
  encryption_key_version text not null,
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  created_by_member_id text not null references public.celestial_organization_members(member_id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, client_request_id),
  foreign key (pack_id, pack_version) references public.celestial_interpretation_packs(pack_id, version),
  constraint report_deletion_redacts_payload check ((deleted_at is null and encrypted_payload is not null) or (deleted_at is not null and encrypted_payload is null))
);
create index if not exists celestial_reports_tenant_created_idx on public.celestial_enterprise_reports(organization_id, created_at desc);
create index if not exists celestial_reports_expiry_idx on public.celestial_enterprise_reports(expires_at) where deleted_at is null;

create table if not exists public.celestial_report_deletion_events (
  deletion_id bigint generated always as identity primary key,
  report_id text not null references public.celestial_enterprise_reports(report_id),
  organization_id text not null references public.celestial_organizations(organization_id),
  actor_member_id text references public.celestial_organization_members(member_id),
  reason text not null check (reason in ('customer-request','retention-expired','organization-closure')),
  deleted_at timestamptz not null default now()
);

create table if not exists public.celestial_batch_jobs (
  batch_id text primary key check (batch_id ~ '^celbatch_[a-f0-9]{24}$'),
  organization_id text not null references public.celestial_organizations(organization_id),
  client_request_id text not null,
  status text not null check (status in ('accepted','processing','completed','partially-failed','failed')),
  request_count integer not null check (request_count between 1 and 100),
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  result_manifest jsonb,
  created_by_member_id text not null references public.celestial_organization_members(member_id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, client_request_id)
);

create table if not exists public.celestial_webhook_endpoints (
  endpoint_id text primary key check (endpoint_id ~ '^celwh_[a-f0-9]{24}$'),
  organization_id text not null references public.celestial_organizations(organization_id),
  target_url text not null check (target_url ~ '^https://'),
  encrypted_signing_secret text not null,
  event_types text[] not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_by_member_id text not null references public.celestial_organization_members(member_id),
  created_at timestamptz not null default now(),
  unique (endpoint_id, organization_id)
);

create table if not exists public.celestial_webhook_deliveries (
  delivery_id text primary key check (delivery_id ~ '^celdel_[a-f0-9]{24}$'),
  endpoint_id text not null,
  organization_id text not null references public.celestial_organizations(organization_id),
  event_type text not null,
  event_sha256 text not null check (event_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','delivering','delivered','retrying','failed')),
  attempts integer not null default 0 check (attempts between 0 and 12),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_status integer,
  created_at timestamptz not null default now(),
  foreign key (endpoint_id, organization_id) references public.celestial_webhook_endpoints(endpoint_id, organization_id)
);

create table if not exists public.celestial_enterprise_usage_events (
  usage_id bigint generated always as identity primary key,
  organization_id text not null references public.celestial_organizations(organization_id),
  api_key_id text not null,
  operation text not null,
  report_count integer not null check (report_count between 0 and 100),
  billable_units integer not null check (billable_units between 0 and 500),
  input_bytes integer not null check (input_bytes >= 0),
  output_bytes integer not null check (output_bytes >= 0),
  status integer not null check (status between 100 and 599),
  occurred_at timestamptz not null
);

create or replace function public.claim_celestial_webhook_deliveries(p_limit integer default 25)
returns setof public.celestial_webhook_deliveries language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select delivery_id from public.celestial_webhook_deliveries
    where status in ('pending','retrying','delivering') and next_attempt_at <= clock_timestamp()
    order by next_attempt_at, created_at limit greatest(1, least(p_limit, 100)) for update skip locked
  )
  update public.celestial_webhook_deliveries d set status = 'delivering', next_attempt_at = clock_timestamp() + interval '15 minutes'
  from candidates c where d.delivery_id = c.delivery_id returning d.*;
end;
$$;
create index if not exists celestial_usage_tenant_time_idx on public.celestial_enterprise_usage_events(organization_id, occurred_at desc);

create or replace function public.celestial_usage_summary(p_organization_id text, p_period_start timestamptz, p_period_end timestamptz)
returns table(operation text, request_count bigint, report_count bigint, billable_units bigint, input_bytes bigint, output_bytes bigint)
language sql stable security definer set search_path = public as $$
  select u.operation, count(*), sum(u.report_count), sum(u.billable_units), sum(u.input_bytes), sum(u.output_bytes)
  from public.celestial_enterprise_usage_events u
  where u.organization_id = p_organization_id and u.occurred_at >= p_period_start and u.occurred_at < p_period_end
  group by u.operation order by u.operation
$$;

create table if not exists public.celestial_service_incidents (
  incident_id text primary key check (incident_id ~ '^celinc_[a-z0-9]{16,48}$'),
  severity text not null check (severity in ('sev1','sev2','sev3','maintenance')),
  status text not null check (status in ('investigating','identified','monitoring','resolved')),
  affected_components text[] not null,
  customer_summary text not null,
  started_at timestamptz not null,
  resolved_at timestamptz,
  postmortem_url text,
  created_at timestamptz not null default now()
);

create or replace function public.delete_celestial_enterprise_report(p_organization_id text, p_report_id text, p_actor_member_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.celestial_enterprise_reports set encrypted_payload = null, deleted_at = clock_timestamp()
    where organization_id = p_organization_id and report_id = p_report_id and deleted_at is null;
  if not found then return false; end if;
  insert into public.celestial_report_deletion_events(report_id, organization_id, actor_member_id, reason)
    values (p_report_id, p_organization_id, p_actor_member_id, 'customer-request');
  return true;
end;
$$;

create or replace function public.purge_expired_celestial_reports(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path = public as $$
declare purged integer;
begin
  with expired as (
    select report_id from public.celestial_enterprise_reports where deleted_at is null and expires_at <= clock_timestamp() order by expires_at limit greatest(1, least(p_limit, 1000)) for update skip locked
  ), redacted as (
    update public.celestial_enterprise_reports r set encrypted_payload = null, deleted_at = clock_timestamp() from expired e where r.report_id = e.report_id returning r.report_id, r.organization_id
  )
  insert into public.celestial_report_deletion_events(report_id, organization_id, actor_member_id, reason)
    select report_id, organization_id, null, 'retention-expired' from redacted;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['celestial_organizations','celestial_organization_members','celestial_interpretation_packs','celestial_organization_packs','celestial_enterprise_reports','celestial_report_deletion_events','celestial_batch_jobs','celestial_webhook_endpoints','celestial_webhook_deliveries','celestial_enterprise_usage_events','celestial_service_incidents']
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

revoke all on table public.celestial_organizations, public.celestial_organization_members, public.celestial_interpretation_packs,
  public.celestial_organization_packs, public.celestial_enterprise_reports, public.celestial_report_deletion_events,
  public.celestial_batch_jobs, public.celestial_webhook_endpoints, public.celestial_webhook_deliveries,
  public.celestial_enterprise_usage_events, public.celestial_service_incidents from public, anon, authenticated;
grant select, insert, update on table public.celestial_organizations, public.celestial_organization_members, public.celestial_organization_packs,
  public.celestial_batch_jobs, public.celestial_webhook_endpoints, public.celestial_webhook_deliveries to service_role;
grant select on table public.celestial_interpretation_packs to service_role;
grant select, insert, update on table public.celestial_service_incidents to service_role;
grant select, insert on table public.celestial_enterprise_reports, public.celestial_report_deletion_events, public.celestial_enterprise_usage_events to service_role;
revoke all on sequence public.celestial_report_deletion_events_deletion_id_seq, public.celestial_enterprise_usage_events_usage_id_seq from public, anon, authenticated;
grant usage, select on sequence public.celestial_report_deletion_events_deletion_id_seq, public.celestial_enterprise_usage_events_usage_id_seq to service_role;
revoke delete, truncate on table public.celestial_organizations, public.celestial_organization_members, public.celestial_interpretation_packs,
  public.celestial_organization_packs, public.celestial_enterprise_reports, public.celestial_report_deletion_events,
  public.celestial_batch_jobs, public.celestial_webhook_endpoints, public.celestial_webhook_deliveries,
  public.celestial_enterprise_usage_events, public.celestial_service_incidents from service_role;
revoke all on function public.delete_celestial_enterprise_report(text,text,text), public.purge_expired_celestial_reports(integer) from public, anon, authenticated;
grant execute on function public.delete_celestial_enterprise_report(text,text,text), public.purge_expired_celestial_reports(integer) to service_role;
revoke all on function public.claim_celestial_webhook_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_celestial_webhook_deliveries(integer) to service_role;
revoke all on function public.celestial_usage_summary(text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.celestial_usage_summary(text,timestamptz,timestamptz) to service_role;
