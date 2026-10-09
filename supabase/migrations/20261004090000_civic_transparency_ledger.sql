-- Apply through normal migration review. No donations, signatures or chain writes.
create table public.civic_ledger_receipts (
  ledger_id text not null check (ledger_id ~ '^[a-z0-9-]{1,100}$'),
  sequence bigint not null check (sequence between 1 and 9007199254740991),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  event_id text not null,
  transfer_key text,
  canonical_payload text not null,
  receipt jsonb not null,
  stored_at timestamptz not null default now(),
  primary key (ledger_id, sequence),
  unique (ledger_id, digest), unique (ledger_id, event_id), unique (ledger_id, transfer_key)
);
alter table public.civic_ledger_receipts enable row level security;
revoke all on public.civic_ledger_receipts from public, anon, authenticated, service_role;
grant select on public.civic_ledger_receipts to service_role;

-- RFC 8785-compatible serialization for this restricted receipt schema:
-- ASCII object keys, strings, arrays and safe integers only (no economic floats).
create function public.civic_receipt_canonical(p_value jsonb) returns text
language plpgsql immutable strict set search_path=public,pg_temp as $$
declare v_type text:=jsonb_typeof(p_value); v_text text; v_number numeric;
begin
  if v_type='object' then
    if exists(select 1 from jsonb_object_keys(p_value) k where k !~ '^[A-Za-z][A-Za-z0-9]*$') then raise exception 'invalid_civic_key'; end if;
    select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.civic_receipt_canonical(value),',' order by key collate "C"),'')||'}'
      into v_text from jsonb_each(p_value);
    return v_text;
  elsif v_type='array' then
    select '['||coalesce(string_agg(public.civic_receipt_canonical(value),',' order by ordinal),'')||']'
      into v_text from jsonb_array_elements(p_value) with ordinality a(value,ordinal);
    return v_text;
  elsif v_type='number' then
    v_number:=(p_value::text)::numeric;
    if v_number<>trunc(v_number) or abs(v_number)>9007199254740991 then raise exception 'invalid_civic_number'; end if;
    return v_number::bigint::text;
  else return p_value::text;
  end if;
end $$;
revoke all on function public.civic_receipt_canonical(jsonb) from public,anon,authenticated,service_role;

create function public.reject_civic_receipt_mutation() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'civic_receipts_are_append_only'; end $$;
create trigger civic_receipts_no_rewrite before update or delete on public.civic_ledger_receipts
for each row execute function public.reject_civic_receipt_mutation();
create trigger civic_receipts_no_truncate before truncate on public.civic_ledger_receipts
for each statement execute function public.reject_civic_receipt_mutation();
revoke all on function public.reject_civic_receipt_mutation() from public, anon, authenticated, service_role;

create function public.append_civic_receipt(p_receipt jsonb, p_canonical_payload text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id text; v_sequence bigint; v_head public.civic_ledger_receipts; v_transfer text;
begin
  if octet_length(p_canonical_payload)>32768 or jsonb_typeof(p_receipt)<>'object'
    or p_receipt->>'version' is distinct from 'civic-ledger-1'
    or (select count(*) from jsonb_object_keys(p_receipt))<>6
    or not (p_receipt ?& array['version','ledgerId','sequence','previousDigest','event','digest'])
    or p_canonical_payload is distinct from public.civic_receipt_canonical(p_receipt-'digest')
    or p_receipt->>'digest' is distinct from encode(digest(convert_to(p_canonical_payload,'UTF8'),'sha256'),'hex')
    or jsonb_typeof(p_receipt->'event') is distinct from 'object'
    or coalesce(p_receipt#>>'{event,id}','') !~ '^[a-z0-9-]{1,100}$'
    or coalesce(p_receipt#>>'{event,kind}','') not in ('contribution','expense','decision')
    or coalesce(p_receipt->>'previousDigest','') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_receipt->'sequence') is distinct from 'number'
    or coalesce(p_receipt->>'sequence','') !~ '^[1-9][0-9]*$'
  then raise exception 'invalid_civic_receipt'; end if;
  v_id := p_receipt->>'ledgerId'; v_sequence := (p_receipt->>'sequence')::bigint;
  if v_id !~ '^[a-z0-9-]{1,100}$' or v_sequence>9007199254740991 then raise exception 'invalid_civic_identity'; end if;
  perform pg_advisory_xact_lock(hashtextextended('civic-ledger:'||v_id,0));
  select * into v_head from public.civic_ledger_receipts where ledger_id=v_id order by sequence desc limit 1;
  if v_sequence<>coalesce(v_head.sequence,0)+1
    or p_receipt->>'previousDigest' is distinct from coalesce(v_head.digest,repeat('0',64))
  then raise exception 'stale_civic_head'; end if;
  if p_receipt#>>'{event,kind}'<>'decision' then
    if p_receipt#>>'{event,transfer,network}' is distinct from 'eip155:8453'
      or p_receipt#>>'{event,transfer,asset}' is distinct from '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      or coalesce(p_receipt#>>'{event,amountBaseUnits}','') !~ '^[1-9][0-9]{0,77}$'
      or coalesce(p_receipt#>>'{event,transfer,transactionHash}','') !~ '^0x[0-9a-f]{64}$'
      or coalesce(p_receipt#>>'{event,transfer,logIndex}','') !~ '^(0|[1-9][0-9]*)$'
    then raise exception 'invalid_civic_transfer'; end if;
    v_transfer := (p_receipt#>>'{event,transfer,transactionHash}')||':'||(p_receipt#>>'{event,transfer,logIndex}');
  end if;
  insert into public.civic_ledger_receipts(ledger_id,sequence,digest,event_id,transfer_key,canonical_payload,receipt)
    values(v_id,v_sequence,p_receipt->>'digest',p_receipt#>>'{event,id}',v_transfer,p_canonical_payload,p_receipt);
  return p_receipt;
end $$;
revoke all on function public.append_civic_receipt(jsonb,text) from public,anon,authenticated;
grant execute on function public.append_civic_receipt(jsonb,text) to service_role;

-- STABLE gives every read in this call the same statement snapshot.
create function public.read_civic_ledger_page(p_ledger_id text,p_after bigint,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_head_sequence bigint; v_head_digest text; v_previous_digest text; v_receipts jsonb; v_count integer;
begin
  if p_ledger_id is null or p_ledger_id !~ '^[a-z0-9-]{1,100}$' or p_after is null
    or p_after<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_civic_cursor'; end if;
  select sequence,digest into v_head_sequence,v_head_digest from public.civic_ledger_receipts
    where ledger_id=p_ledger_id order by sequence desc limit 1;
  v_head_sequence:=coalesce(v_head_sequence,0); v_head_digest:=coalesce(v_head_digest,repeat('0',64));
  if p_after>v_head_sequence then raise exception 'invalid_civic_cursor'; end if;
  if p_after=0 then v_previous_digest:=repeat('0',64);
  else select digest into strict v_previous_digest from public.civic_ledger_receipts where ledger_id=p_ledger_id and sequence=p_after; end if;
  select coalesce(jsonb_agg(receipt order by sequence),'[]'::jsonb),count(*) into v_receipts,v_count from (
    select sequence,receipt from public.civic_ledger_receipts where ledger_id=p_ledger_id and sequence>p_after order by sequence limit p_limit
  ) page;
  return jsonb_build_object('preceding',jsonb_build_object('ledgerId',p_ledger_id,'sequence',p_after,'digest',v_previous_digest),
    'head',jsonb_build_object('ledgerId',p_ledger_id,'sequence',v_head_sequence,'digest',v_head_digest),
    'receipts',v_receipts,'hasMore',p_after+v_count<v_head_sequence);
end $$;
revoke all on function public.read_civic_ledger_page(text,bigint,integer) from public,anon,authenticated;
grant execute on function public.read_civic_ledger_page(text,bigint,integer) to service_role;
