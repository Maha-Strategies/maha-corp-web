-- Private citizen concerns. Requires the civic canonicalization migration.
-- No public read/write policies, publication, model calls or financial transfers.
create table public.civic_safety_concerns (
  id uuid primary key,
  record jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  check (record #>> '{receipt,id}' = id::text)
);
create table public.civic_safety_usage (
  usage_day date not null,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  submissions integer not null check (submissions between 1 and 3),
  primary key (usage_day, visitor_hash)
);
alter table public.civic_safety_concerns enable row level security;
alter table public.civic_safety_usage enable row level security;
revoke all on public.civic_safety_concerns, public.civic_safety_usage from public, anon, authenticated, service_role;

create function public.purge_expired_civic_safety_concerns() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.civic_safety_concerns where expires_at <= now();
  delete from public.civic_safety_usage where usage_day < (now() at time zone 'utc')::date - 1;
end;
$$;
create function public.civic_safety_intake_status() returns boolean
language sql security definer set search_path = '' as $$ select true; $$;

create function public.submit_civic_safety_concern(p_record jsonb, p_visitor_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing jsonb;
  submission jsonb := p_record -> 'submission';
  receipt jsonb := p_record -> 'receipt';
  day_key date := (now() at time zone 'utc')::date;
  used integer;
  total_used integer;
begin
  if p_record is null or p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$'
    or octet_length(p_record::text) > 24000
    or p_record ->> 'status' is distinct from 'received'
    or p_record -> 'review' is distinct from 'null'::jsonb
    or receipt ->> 'version' is distinct from 'civic-ai-safety-1'
    or receipt ->> 'id' is distinct from submission ->> 'submissionId'
    or submission -> 'consentToPrivateReview' is distinct from 'true'::jsonb
    or length(submission ->> 'concern') not between 20 and 4000
    or length(submission ->> 'requestedAction') not between 10 and 1500
    or receipt ->> 'submissionDigest' is distinct from encode(extensions.digest(public.civic_receipt_canonical(submission), 'sha256'), 'hex')
    or receipt ->> 'digest' is distinct from encode(extensions.digest(public.civic_receipt_canonical(receipt - 'digest'), 'sha256'), 'hex')
  then raise exception 'invalid_safety_record'; end if;
  -- Serialize quota consumption and retry detection across server instances.
  perform pg_catalog.pg_advisory_xact_lock(80361008);
  perform public.purge_expired_civic_safety_concerns();
  select record into existing from public.civic_safety_concerns where id = (receipt ->> 'id')::uuid;
  if found then
    if existing -> 'submission' is distinct from submission then raise exception 'safety_id_conflict'; end if;
    return existing;
  end if;
  select coalesce(sum(submissions), 0) into total_used from public.civic_safety_usage where usage_day = day_key;
  select submissions into used from public.civic_safety_usage where usage_day = day_key and visitor_hash = p_visitor_hash;
  if coalesce(used, 0) >= 3 or total_used >= 1000 then raise exception 'safety_rate_limited'; end if;
  insert into public.civic_safety_usage values (day_key, p_visitor_hash, 1)
    on conflict (usage_day, visitor_hash) do update set submissions = public.civic_safety_usage.submissions + 1;
  insert into public.civic_safety_concerns (id, record) values ((receipt ->> 'id')::uuid, p_record);
  return p_record;
end;
$$;

create function public.read_civic_safety_inbox(p_before uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.purge_expired_civic_safety_concerns();
  -- UUID ordering gives stable bounded pagination without a public list endpoint.
  select coalesce(jsonb_agg(record order by id desc), '[]'::jsonb) into result
  from (select id, record from public.civic_safety_concerns
    where expires_at > now() and (p_before is null or id < p_before)
    order by id desc limit 50) page;
  return result;
end;
$$;
create function public.review_civic_safety_concern(p_id uuid, p_status text, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_status is null or p_status not in ('reviewed', 'needs-research', 'out-of-scope')
    or p_note is null or length(trim(p_note)) not between 10 and 2000 then raise exception 'invalid_safety_review'; end if;
  update public.civic_safety_concerns set record = jsonb_set(jsonb_set(record, '{status}', to_jsonb(p_status)),
    '{review}', jsonb_build_object('reviewedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'note', trim(p_note)))
    where id = p_id and expires_at > now() returning record into result;
  return result;
end;
$$;

revoke all on function public.purge_expired_civic_safety_concerns(), public.civic_safety_intake_status(),
  public.submit_civic_safety_concern(jsonb,text), public.read_civic_safety_inbox(uuid),
  public.review_civic_safety_concern(uuid,text,text) from public, anon, authenticated;
grant execute on function public.purge_expired_civic_safety_concerns(), public.civic_safety_intake_status(),
  public.submit_civic_safety_concern(jsonb,text), public.read_civic_safety_inbox(uuid),
  public.review_civic_safety_concern(uuid,text,text) to service_role;
-- Before enabling intake, schedule purge_expired_civic_safety_concerns daily
-- using the deployment's approved scheduler. Intake and inbox reads also purge.
