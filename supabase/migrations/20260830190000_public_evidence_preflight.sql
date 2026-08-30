create table if not exists public.evidence_preflight_request_ledger (
  request_hash text primary key check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  visitor_hash text not null check (visitor_hash ~ '^sha256:[a-f0-9]{64}$'),
  payload_hmac text not null check (payload_hmac ~ '^sha256:[a-f0-9]{64}$'),
  claim_count smallint not null check (claim_count between 1 and 3),
  input_char_count integer not null check (input_char_count between 1 and 7500),
  doi_count smallint not null check (doi_count between 0 and 3),
  url_count smallint not null check (url_count between 0 and 3),
  ready_count smallint not null check (ready_count between 0 and 3),
  blocked_count smallint not null check (blocked_count between 0 and 3),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  check (doi_count + url_count = claim_count),
  check (ready_count + blocked_count = claim_count)
);

create index if not exists evidence_preflight_request_ledger_visitor_time_idx
  on public.evidence_preflight_request_ledger (visitor_hash, first_seen_at desc);

create index if not exists evidence_preflight_request_ledger_expiry_idx
  on public.evidence_preflight_request_ledger (expires_at);

create or replace function public.record_evidence_preflight_request(
  p_request_hash text,
  p_visitor_hash text,
  p_payload_hmac text,
  p_claim_count smallint,
  p_input_char_count integer,
  p_doi_count smallint,
  p_url_count smallint,
  p_ready_count smallint,
  p_blocked_count smallint,
  p_daily_limit smallint default 5
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_payload_hmac text;
  daily_count integer;
begin
  if p_request_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_visitor_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_payload_hmac !~ '^sha256:[a-f0-9]{64}$'
    or p_claim_count < 1 or p_claim_count > 3
    or p_input_char_count < 1 or p_input_char_count > 7500
    or p_doi_count < 0 or p_url_count < 0 or p_doi_count + p_url_count <> p_claim_count
    or p_ready_count < 0 or p_blocked_count < 0 or p_ready_count + p_blocked_count <> p_claim_count
    or p_daily_limit < 1 or p_daily_limit > 20 then
    raise exception 'Invalid evidence preflight ledger request.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_hash || ':' || current_date::text, 0));

  select payload_hmac into existing_payload_hmac
  from public.evidence_preflight_request_ledger
  where request_hash = p_request_hash;

  if found then
    update public.evidence_preflight_request_ledger
      set last_seen_at = now()
      where request_hash = p_request_hash;
    if existing_payload_hmac = p_payload_hmac then return 'idempotent'; end if;
    return 'conflict';
  end if;

  select count(*) into daily_count
  from public.evidence_preflight_request_ledger
  where visitor_hash = p_visitor_hash
    and first_seen_at >= date_trunc('day', now())
    and first_seen_at < date_trunc('day', now()) + interval '1 day';

  if daily_count >= p_daily_limit then return 'rate_limited'; end if;

  insert into public.evidence_preflight_request_ledger (
    request_hash, visitor_hash, payload_hmac, claim_count, input_char_count,
    doi_count, url_count, ready_count, blocked_count
  ) values (
    p_request_hash, p_visitor_hash, p_payload_hmac, p_claim_count, p_input_char_count,
    p_doi_count, p_url_count, p_ready_count, p_blocked_count
  );
  return 'created';
end;
$$;

alter table public.evidence_preflight_request_ledger enable row level security;

revoke all on table public.evidence_preflight_request_ledger from public, anon, authenticated;
revoke all on function public.record_evidence_preflight_request(text, text, text, smallint, integer, smallint, smallint, smallint, smallint, smallint) from public, anon, authenticated;
grant execute on function public.record_evidence_preflight_request(text, text, text, smallint, integer, smallint, smallint, smallint, smallint, smallint) to service_role;

comment on table public.evidence_preflight_request_ledger is
  'Metadata-only, keyed-pseudonym ledger for deterministic public evidence preflight rate limiting and replay safety. It stores no claims, excerpts, source identifiers, titles, locators, request bodies, raw IP addresses, or user-agent strings.';

comment on column public.evidence_preflight_request_ledger.payload_hmac is
  'Server-keyed commitment used only to distinguish an idempotent replay from request-ID substitution; it is not a public content hash.';

