-- Private, structured content drafts. A draft is not a public page and this
-- ledger intentionally has no connection to routes, the sitemap, or deployment.

create table if not exists public.content_page_drafts (
  public_id text primary key check (public_id ~ '^contentdraft_[a-f0-9]{32}$'),
  candidate_id text not null unique references public.content_page_candidates(public_id) on delete restrict,
  title text not null check (char_length(title) between 20 and 160),
  summary text not null check (char_length(summary) between 80 and 600),
  direct_answer text not null check (char_length(direct_answer) between 120 and 1800),
  method text not null check (char_length(method) between 120 and 2400),
  artifact_url text,
  artifact_label text,
  limitations text,
  editorial_reviewer text not null check (char_length(editorial_reviewer) between 3 and 160),
  status text not null default 'draft' check (status in ('draft','editorial_ready','archived')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((artifact_url is null and artifact_label is null) or (artifact_url is not null and artifact_label is not null)),
  check (artifact_url is null or artifact_url ~ '^https://'),
  check (limitations is null or char_length(limitations) between 40 and 1800)
);

create table if not exists public.content_page_draft_events (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null references public.content_page_drafts(public_id) on delete restrict,
  action text not null check (action in ('composed','mark_editorial_ready','archive')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (draft_id, idempotency_hash)
);

create index if not exists content_page_drafts_status_idx on public.content_page_drafts (status, updated_at desc);
alter table public.content_page_drafts enable row level security;
alter table public.content_page_draft_events enable row level security;
revoke all on table public.content_page_drafts, public.content_page_draft_events from public, anon, authenticated;
grant select, insert, update on table public.content_page_drafts to service_role;
grant select, insert on table public.content_page_draft_events to service_role;

create or replace function public.compose_content_page_draft(
  p_draft_id text, p_candidate_id text, p_title text, p_summary text, p_direct_answer text, p_method text,
  p_artifact_url text, p_artifact_label text, p_limitations text, p_editorial_reviewer text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_candidate public.content_page_candidates%rowtype; v_existing public.content_page_drafts%rowtype;
begin
  if p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or char_length(p_title) not between 20 and 160 or char_length(p_summary) not between 80 and 600
    or char_length(p_direct_answer) not between 120 and 1800 or char_length(p_method) not between 120 and 2400
    or char_length(p_editorial_reviewer) not between 3 and 160
    or (p_artifact_url is null) <> (p_artifact_label is null) or (p_artifact_url is not null and p_artifact_url !~ '^https://')
    or (p_artifact_label is not null and char_length(p_artifact_label) not between 3 and 200)
    or (p_limitations is not null and char_length(p_limitations) not between 40 and 1800)
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid content draft.' using errcode='22023'; end if;
  select * into v_candidate from public.content_page_candidates where public_id=p_candidate_id for update;
  if not found then raise exception 'Content candidate not found.' using errcode='P0002'; end if;
  if v_candidate.status <> 'approved_for_draft' then raise exception 'The candidate requires human draft approval first.' using errcode='P0001'; end if;
  select * into v_existing from public.content_page_drafts where candidate_id=p_candidate_id for update;
  if found then return jsonb_build_object('draftId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;
  insert into public.content_page_drafts (public_id,candidate_id,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status,created_at,updated_at)
    values (p_draft_id,p_candidate_id,p_title,p_summary,p_direct_answer,p_method,nullif(p_artifact_url,''),nullif(p_artifact_label,''),nullif(p_limitations,''),p_editorial_reviewer,'draft',p_at,p_at);
  insert into public.content_page_draft_events (draft_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_draft_id,'composed',p_idempotency_hash,p_actor_fingerprint,'Private draft composed. No public page, sitemap entry, or publish action was created.',p_at);
  return jsonb_build_object('draftId',p_draft_id,'status','draft','idempotentReplay',false);
end;
$$;

create or replace function public.operate_content_page_draft(
  p_draft_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_status text;
begin
  if p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_action not in ('mark_editorial_ready','archive')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000)
  then raise exception 'Invalid content draft operation.' using errcode='22023'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found then raise exception 'Content draft not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.content_page_draft_events where draft_id=p_draft_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('draftId',p_draft_id,'status',v_draft.status,'idempotentReplay',true); end if;
  v_status := case p_action when 'mark_editorial_ready' then 'editorial_ready' else 'archived' end;
  if not ((p_action='mark_editorial_ready' and v_draft.status='draft') or (p_action='archive' and v_draft.status in ('draft','editorial_ready'))) then raise exception 'Operation is not allowed for the current draft state.' using errcode='P0001'; end if;
  insert into public.content_page_draft_events (draft_id,action,idempotency_hash,actor_fingerprint,note,created_at) values (p_draft_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.content_page_drafts set status=v_status, reviewer_note=nullif(p_note,''), updated_at=p_at where public_id=p_draft_id;
  return jsonb_build_object('draftId',p_draft_id,'status',v_status,'idempotentReplay',false);
end;
$$;

revoke all on function public.compose_content_page_draft(text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.operate_content_page_draft(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.compose_content_page_draft(text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.operate_content_page_draft(text,text,text,text,text,timestamptz) to service_role;
