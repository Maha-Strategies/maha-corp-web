-- Local preparation only; not applied to any remote database.
create table public.corporate_review_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rule','event')),
  target text not null,
  grant_hash text,
  record_snapshot jsonb not null,
  idempotency_hash text not null unique,
  request_digest text not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((kind='rule' and grant_hash is null) or (kind='event' and grant_hash ~ '^sha256:[a-f0-9]{64}$'))
);
alter table public.corporate_review_records enable row level security;
revoke all on public.corporate_review_records from public, anon, authenticated;
grant select, insert on public.corporate_review_records to service_role;
create function public.refuse_corporate_review_mutation() returns trigger language plpgsql as $$
begin raise exception 'Corporate review records are append-only'; end $$;
create trigger corporate_review_immutable before update or delete on public.corporate_review_records for each row execute function public.refuse_corporate_review_mutation();
create function public.append_corporate_review(p_record jsonb, p_idempotency_hash text, p_request_digest text) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if (jsonb_typeof(p_record) = 'object' and p_record->>'kind' in ('rule','event') and length(p_record->>'target') > 0
    and p_record->>'actorFingerprint' ~ '^sha256:[a-f0-9]{64}$'
    and p_record->'snapshot'->>'recordDigest' ~ '^sha256:[a-f0-9]{64}$'
    and p_idempotency_hash ~ '^sha256:[a-f0-9]{64}$' and p_request_digest ~ '^sha256:[a-f0-9]{64}$'
    and p_record - array['kind','target','grantHash','expiresAt','snapshot','actorFingerprint','attestations'] = '{}'::jsonb) is not true
    then raise exception 'Invalid review envelope'; end if;
  insert into public.corporate_review_records(kind,target,grant_hash,record_snapshot,idempotency_hash,request_digest)
    values(p_record->>'kind',p_record->>'target',p_record->>'grantHash',p_record,p_idempotency_hash,p_request_digest);
  -- A repeated key is refused atomically; it never appends a second decision.
end $$;
revoke all on function public.append_corporate_review(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.append_corporate_review(jsonb,text,text) to service_role;
create index corporate_review_lookup on public.corporate_review_records(kind,target,grant_hash,created_at);
