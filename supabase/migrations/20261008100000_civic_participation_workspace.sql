create table public.civic_safety_cases (
  id uuid primary key, key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  state jsonb not null, expires_at timestamptz not null default now() + interval '90 days',
  operation_id uuid, operation_digest text,
  check (state ->> 'id' = id::text)
);
create table public.civic_consultations (
  id uuid primary key, state jsonb not null, operation_id uuid, operation_digest text,
  check (state ->> 'id' = id::text)
);
alter table public.civic_safety_cases enable row level security;
alter table public.civic_consultations enable row level security;
revoke all on public.civic_safety_cases, public.civic_consultations from public, anon, authenticated, service_role;

create or replace function public.purge_expired_civic_safety_concerns() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.civic_safety_cases where expires_at <= now();
  delete from public.civic_safety_concerns where expires_at <= now();
  delete from public.civic_safety_usage where usage_day < (now() at time zone 'utc')::date - 1;
end;
$$;
create function public.civic_workspace_version() returns integer
language sql security definer set search_path = '' as $$ select 1; $$;

create function public.submit_civic_safety_case(p_record jsonb, p_visitor_hash text, p_key_hash text, p_state jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.civic_safety_cases; saved jsonb; consultation jsonb; response jsonb := p_record #> '{submission,consultationResponse}';
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_state ->> 'version' is distinct from 'civic-case-1' or p_state ->> 'revision' is distinct from '1'
    or p_state -> 'receipt' is distinct from p_record -> 'receipt'
    or p_state -> 'submission' is distinct from p_record -> 'submission'
    or p_state ->> 'id' is distinct from p_record #>> '{receipt,id}'
    or p_state ->> 'status' is distinct from 'received'
    or p_state -> 'publication' is distinct from 'null'::jsonb then raise exception 'invalid_safety_case'; end if;
  perform pg_catalog.pg_advisory_xact_lock(80361008);
  perform public.purge_expired_civic_safety_concerns();
  select * into existing from public.civic_safety_cases where id = (p_state ->> 'id')::uuid;
  if found then
    if existing.key_hash <> p_key_hash then raise exception 'workspace_access'; end if;
    if existing.state ->> 'status' = 'withdrawn' then raise exception 'workspace_access'; end if;
    -- Original intake remains immutable even after citizen corrections.
    select record into saved from public.civic_safety_concerns where id = existing.id;
    if saved -> 'submission' is distinct from p_record -> 'submission' then raise exception 'safety_id_conflict'; end if;
    return saved;
  end if;
  if exists(select 1 from public.civic_safety_concerns where id=(p_state ->> 'id')::uuid) then raise exception 'legacy_access_not_issued'; end if;
  if response is not null then
    select state into consultation from public.civic_consultations where id=(response ->> 'consultationId')::uuid;
    if consultation is null or consultation ->> 'status' <> 'open'
      or consultation ->> 'packetDigest' is distinct from response ->> 'packetDigest'
      or (consultation #>> '{packet,opensAt}')::timestamptz > now() or (consultation #>> '{packet,closesAt}')::timestamptz <= now()
      or not exists(select 1 from jsonb_array_elements(consultation #> '{packet,alternatives}') a where a ->> 'id' = response ->> 'alternativeId')
    then raise exception 'consultation_closed_or_changed'; end if;
  end if;
  saved := public.submit_civic_safety_concern(p_record, p_visitor_hash);
  insert into public.civic_safety_cases(id,key_hash,state) values ((p_state ->> 'id')::uuid,p_key_hash,p_state);
  return saved;
end;
$$;

create function public.read_civic_workspace_record(p_kind text, p_id uuid, p_key_hash text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare row_state jsonb; op uuid; op_digest text;
begin
  if p_kind='case' then
    select state,operation_id,operation_digest into row_state,op,op_digest from public.civic_safety_cases
      where id=p_id and expires_at>now() and (p_key_hash is null or key_hash=p_key_hash);
  elsif p_kind='consultation' and p_key_hash is null then
    select state,operation_id,operation_digest into row_state,op,op_digest from public.civic_consultations where id=p_id;
  else raise exception 'workspace_access'; end if;
  if row_state is null then return null; end if;
  return jsonb_build_object('state',row_state,'operationId',op,'operationDigest',op_digest);
end;
$$;
create function public.list_civic_workspace_records(p_kind text, p_before uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.purge_expired_civic_safety_concerns();
  if p_kind='case' then
    select coalesce(jsonb_agg(state order by id desc),'[]'::jsonb) into result from
      (select id,state from public.civic_safety_cases where expires_at>now() and (p_before is null or id<p_before) order by id desc limit 50) page;
  elsif p_kind='consultation' then
    select coalesce(jsonb_agg(state order by id desc),'[]'::jsonb) into result from
      (select id,state from public.civic_consultations where p_before is null or id<p_before order by id desc limit 50) page;
  else raise exception 'workspace_access'; end if;
  return result;
end;
$$;
create function public.commit_civic_workspace_record(p_kind text,p_state jsonb,p_revision integer,p_operation_id uuid,p_operation_digest text,p_key_hash text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing jsonb; existing_op uuid; existing_digest text; publication jsonb; draft jsonb;
begin
  if p_state is null or octet_length(p_state::text)>600000 or p_revision<0 or p_operation_id is null
    or p_operation_digest is null or p_operation_digest !~ '^[a-f0-9]{64}$'
    or (p_state ->> 'revision')::integer <> p_revision+1 then raise exception 'invalid_workspace_state'; end if;
  perform pg_catalog.pg_advisory_xact_lock(80361008);
  if p_kind='case' then
    select state,operation_id,operation_digest into existing,existing_op,existing_digest from public.civic_safety_cases
      where id=(p_state ->> 'id')::uuid and expires_at>now() and (p_key_hash is null or key_hash=p_key_hash) for update;
    if existing is null then raise exception 'workspace_access'; end if;
    if p_state -> 'receipt' is distinct from existing -> 'receipt' then raise exception 'invalid_workspace_receipt'; end if;
    publication := p_state -> 'publication';
    if publication is not null and publication <> 'null'::jsonb then
      draft := publication -> 'draft';
      if publication ->> 'digest' is distinct from encode(extensions.digest(public.civic_receipt_canonical(draft),'sha256'),'hex') then raise exception 'invalid_publication_digest'; end if;
      if publication ->> 'publishedAt' is not null and
        (publication -> 'privacyReviewed' is distinct from 'true'::jsonb or publication ->> 'consentedDigest' is distinct from publication ->> 'digest')
      then raise exception 'publication_consent_required'; end if;
    end if;
    if p_state ->> 'status'='withdrawn' and (p_state -> 'submission' is distinct from 'null'::jsonb
      or p_state -> 'messages' is distinct from '[]'::jsonb or p_state #> '{graph,nodes}' is distinct from '[]'::jsonb
      or p_state #> '{graph,edges}' is distinct from '[]'::jsonb or p_state -> 'publication' is distinct from 'null'::jsonb)
    then raise exception 'withdrawal_requires_erasure'; end if;
  elsif p_kind='consultation' and p_key_hash is null then
    select state,operation_id,operation_digest into existing,existing_op,existing_digest from public.civic_consultations where id=(p_state ->> 'id')::uuid for update;
    if p_state ->> 'packetDigest' is distinct from encode(extensions.digest(public.civic_receipt_canonical(p_state -> 'packet'),'sha256'),'hex') then raise exception 'invalid_consultation_digest'; end if;
    if p_state ->> 'status'<>'draft' and p_state -> 'privacyReviewed' is distinct from 'true'::jsonb then raise exception 'consultation_privacy_review_required'; end if;
    if existing is not null and existing ->> 'status'<>'draft' and p_state -> 'packet' is distinct from existing -> 'packet' then raise exception 'consultation_packet_frozen'; end if;
  else raise exception 'workspace_access'; end if;
  if existing_op=p_operation_id then
    if existing_digest is distinct from p_operation_digest then raise exception 'workspace_conflict'; end if;
    return existing;
  end if;
  if coalesce((existing ->> 'revision')::integer,0) <> p_revision then raise exception 'workspace_conflict'; end if;
  if p_kind='case' then
    update public.civic_safety_cases set state=p_state,operation_id=p_operation_id,operation_digest=p_operation_digest where id=(p_state ->> 'id')::uuid;
    if p_state ->> 'status'='withdrawn' then delete from public.civic_safety_concerns where id=(p_state ->> 'id')::uuid; end if;
  else
    insert into public.civic_consultations(id,state,operation_id,operation_digest) values ((p_state ->> 'id')::uuid,p_state,p_operation_id,p_operation_digest)
      on conflict(id) do update set state=excluded.state,operation_id=excluded.operation_id,operation_digest=excluded.operation_digest;
  end if;
  return p_state;
end;
$$;
create function public.read_civic_public_participation() returns jsonb
language sql security definer set search_path = '' as $$
select jsonb_build_object('summaries',coalesce((select jsonb_agg(item) from (
  select jsonb_build_object('summary',state #> '{publication,draft}','digest',state #> '{publication,digest}','publishedAt',state #> '{publication,publishedAt}') item
  from public.civic_safety_cases where expires_at>now() and state ->> 'status'<>'withdrawn'
    and state #>> '{publication,publishedAt}' is not null and state #>> '{publication,consentedDigest}' = state #>> '{publication,digest}'
    and state #> '{publication,privacyReviewed}'='true'::jsonb order by id desc limit 100) page),'[]'::jsonb),
  'consultations',coalesce((select jsonb_agg(state) from (select state from public.civic_consultations
    where state ->> 'status' in ('open','closed') and state -> 'privacyReviewed'='true'::jsonb order by id desc limit 50) page),'[]'::jsonb));
$$;
-- Legacy review labels must not silently diverge from the new case workflow.
create or replace function public.review_civic_safety_concern(p_id uuid,p_status text,p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if exists(select 1 from public.civic_safety_cases where id=p_id) then raise exception 'use_civic_workbench'; end if;
  if p_status is null or p_status not in ('reviewed','needs-research','out-of-scope') or p_note is null or length(trim(p_note)) not between 10 and 2000 then raise exception 'invalid_safety_review'; end if;
  update public.civic_safety_concerns set record=jsonb_set(jsonb_set(record,'{status}',to_jsonb(p_status)),
    '{review}',jsonb_build_object('reviewedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'note',trim(p_note)))
    where id=p_id and expires_at>now() returning record into result;
  return result;
end;
$$;
revoke all on function public.civic_workspace_version(),public.submit_civic_safety_case(jsonb,text,text,jsonb),
  public.read_civic_workspace_record(text,uuid,text),public.list_civic_workspace_records(text,uuid),
  public.commit_civic_workspace_record(text,jsonb,integer,uuid,text,text),public.read_civic_public_participation() from public,anon,authenticated;
grant execute on function public.civic_workspace_version(),public.submit_civic_safety_case(jsonb,text,text,jsonb),
  public.read_civic_workspace_record(text,uuid,text),public.list_civic_workspace_records(text,uuid),
  public.commit_civic_workspace_record(text,jsonb,integer,uuid,text,text),public.read_civic_public_participation() to service_role;
