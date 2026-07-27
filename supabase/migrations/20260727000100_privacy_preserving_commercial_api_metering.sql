-- Privacy-preserving usage accounting for selected credential-based commercial
-- APIs. This is a daily aggregate ledger: it intentionally stores no IP
-- address, user agent, token value/fingerprint, request body, response body,
-- referrer, email, or visitor identifier.

create table if not exists public.commercial_api_usage_daily (
  usage_day date not null default current_date,
  credential_id text not null references public.agent_client_credentials(public_id) on delete restrict,
  operation text not null check (operation in ('mps_audit', 'mps_credit_balance', 'book_entitlement', 'book_content')),
  endpoint text not null check (endpoint in ('/api/mps-audits', '/api/mps-credits', '/api/books/[id]/entitlement', '/api/books/[id]/content')),
  method text not null check (method in ('GET', 'POST')),
  status_class smallint not null check (status_class between 2 and 5),
  request_count bigint not null default 0 check (request_count >= 0),
  unit_quantity numeric(18, 6) not null default 0 check (unit_quantity >= 0 and unit_quantity <= 1000000),
  last_observed_at timestamptz not null default now(),
  primary key (usage_day, credential_id, operation, status_class)
);

create index if not exists commercial_api_usage_daily_operation_day_idx
  on public.commercial_api_usage_daily (operation, usage_day desc);

alter table public.commercial_api_usage_daily enable row level security;
revoke all on table public.commercial_api_usage_daily from public, anon, authenticated;

create or replace function public.record_commercial_api_usage(
  p_credential_id text,
  p_operation text,
  p_endpoint text,
  p_method text,
  p_status_code integer,
  p_unit_quantity numeric,
  p_observed_at timestamptz
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status_class smallint;
begin
  if p_credential_id !~ '^cred_[a-f0-9]{32}$'
    or p_operation not in ('mps_audit', 'mps_credit_balance', 'book_entitlement', 'book_content')
    or p_endpoint not in ('/api/mps-audits', '/api/mps-credits', '/api/books/[id]/entitlement', '/api/books/[id]/content')
    or p_method not in ('GET', 'POST')
    or p_status_code not between 200 and 599
    or p_unit_quantity < 0 or p_unit_quantity > 1000000
    or p_observed_at is null
  then raise exception 'Invalid commercial API usage measurement.' using errcode = '22023'; end if;

  v_status_class := floor(p_status_code / 100)::smallint;
  insert into public.commercial_api_usage_daily
    (usage_day, credential_id, operation, endpoint, method, status_class, request_count, unit_quantity, last_observed_at)
  values
    ((p_observed_at at time zone 'UTC')::date, p_credential_id, p_operation, p_endpoint, p_method, v_status_class, 1, p_unit_quantity, p_observed_at)
  on conflict (usage_day, credential_id, operation, status_class) do update
    set request_count = public.commercial_api_usage_daily.request_count + 1,
        unit_quantity = public.commercial_api_usage_daily.unit_quantity + excluded.unit_quantity,
        last_observed_at = greatest(public.commercial_api_usage_daily.last_observed_at, excluded.last_observed_at);
  return 'recorded';
end;
$$;

revoke all on function public.record_commercial_api_usage(text, text, text, text, integer, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.record_commercial_api_usage(text, text, text, text, integer, numeric, timestamptz) to service_role;

comment on table public.commercial_api_usage_daily is
  'Daily aggregate commercial API measurement. It deliberately excludes IPs, user agents, credentials, request/response bodies, referrers, emails, and visitor identifiers.';
