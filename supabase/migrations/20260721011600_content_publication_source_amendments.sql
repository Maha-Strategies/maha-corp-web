-- Public releases remain immutable snapshots. Source-package corrections are
-- appended as explicit, human-confirmed amendments and never run automatically.
create table if not exists public.content_publication_source_amendments (
  public_id text primary key check (public_id ~ '^contentamend_[a-f0-9]{32}$'),
  publication_id text not null references public.content_publications(public_id) on delete restrict,
  revision integer not null check (revision >= 1),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 3 and 5),
  amendment_note text not null check (char_length(amendment_note) between 3 and 2000),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  amended_at timestamptz not null,
  unique (publication_id, revision),
  unique (publication_id, idempotency_hash)
);

create index if not exists content_publication_source_amendments_latest_idx
  on public.content_publication_source_amendments (publication_id, revision desc);
alter table public.content_publication_source_amendments enable row level security;
revoke all on table public.content_publication_source_amendments from public, anon, authenticated;
grant select, insert on table public.content_publication_source_amendments to service_role;

create or replace function public.amend_content_publication_sources(
  p_amendment_id text, p_publication_id text, p_slug text, p_confirmation text, p_evidence jsonb, p_note text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_publication public.content_publications%rowtype; v_existing public.content_publication_source_amendments%rowtype; v_revision integer;
begin
  if p_amendment_id !~ '^contentamend_[a-f0-9]{32}$' or p_publication_id !~ '^contentpub_[a-f0-9]{32}$'
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_confirmation <> ('AMEND ' || p_slug)
    or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) not between 3 and 5
    or char_length(p_note) not between 3 and 2000 or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid publication source amendment.' using errcode='22023'; end if;
  select * into v_publication from public.content_publications where public_id=p_publication_id and slug=p_slug and unpublished_at is null for update;
  if not found then raise exception 'Published page not found.' using errcode='P0002'; end if;
  select * into v_existing from public.content_publication_source_amendments where publication_id=p_publication_id and idempotency_hash=p_idempotency_hash for update;
  if found then return jsonb_build_object('amendmentId',v_existing.public_id,'revision',v_existing.revision,'idempotentReplay',true); end if;
  select coalesce(max(revision), 0) + 1 into v_revision from public.content_publication_source_amendments where publication_id=p_publication_id;
  insert into public.content_publication_source_amendments (public_id,publication_id,revision,evidence,amendment_note,actor_fingerprint,idempotency_hash,amended_at)
    values (p_amendment_id,p_publication_id,v_revision,p_evidence,p_note,p_actor_fingerprint,p_idempotency_hash,p_at);
  update public.content_publications set updated_at=p_at where public_id=p_publication_id;
  return jsonb_build_object('amendmentId',p_amendment_id,'revision',v_revision,'idempotentReplay',false);
end;
$$;
revoke all on function public.amend_content_publication_sources(text,text,text,text,jsonb,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.amend_content_publication_sources(text,text,text,text,jsonb,text,text,text,timestamptz) to service_role;
