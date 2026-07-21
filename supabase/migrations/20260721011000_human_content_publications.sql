-- A public page can be released only by a human-controlled admin request from
-- a current, score-qualified handoff. No scout, cron, or model can invoke it.

create table if not exists public.content_publications (
  public_id text primary key check (public_id ~ '^contentpub_[a-f0-9]{32}$'),
  handoff_id text not null unique references public.content_publication_handoffs(public_id) on delete restrict,
  draft_id text not null unique references public.content_page_drafts(public_id) on delete restrict,
  candidate_id text not null references public.content_page_candidates(public_id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text not null,
  direct_answer text not null,
  method text not null,
  artifact_url text not null check (artifact_url ~ '^https://'),
  artifact_label text not null,
  limitations text not null,
  editorial_reviewer text not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) >= 3),
  publication_note text,
  published_at timestamptz not null,
  unpublished_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.content_publication_events (
  id uuid primary key default gen_random_uuid(),
  publication_id text not null references public.content_publications(public_id) on delete restrict,
  action text not null check (action = 'published'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (publication_id, idempotency_hash)
);

create index if not exists content_publications_live_idx on public.content_publications (unpublished_at, published_at desc);
alter table public.content_publications enable row level security;
alter table public.content_publication_events enable row level security;
revoke all on table public.content_publications, public.content_publication_events from public, anon, authenticated;
grant select, insert, update on table public.content_publications to service_role;
grant select, insert on table public.content_publication_events to service_role;

create or replace function public.publish_content_page(
  p_publication_id text, p_handoff_id text, p_draft_id text, p_candidate_id text, p_slug text, p_note text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_handoff public.content_publication_handoffs%rowtype; v_draft public.content_page_drafts%rowtype; v_candidate public.content_page_candidates%rowtype; v_existing public.content_publications%rowtype;
begin
  if p_publication_id !~ '^contentpub_[a-f0-9]{32}$' or p_handoff_id !~ '^contenthandoff_[a-f0-9]{32}$' or p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 3 and 100
    or (p_note is not null and char_length(p_note) not between 3 and 2000)
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid human publication request.' using errcode='22023'; end if;
  select * into v_handoff from public.content_publication_handoffs where public_id=p_handoff_id and superseded_at is null for update;
  if not found or v_handoff.draft_id <> p_draft_id or v_handoff.candidate_id <> p_candidate_id or v_handoff.decision <> 'ready_for_human_publish' or v_handoff.release_score < 70
    or not (v_handoff.checklist @> '{"summaryComplete":true,"mahaMethodComplete":true,"limitsIncluded":true,"evidenceArtifactIncluded":true}'::jsonb)
  then raise exception 'A score-qualified publication handoff is required.' using errcode='P0001'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found then raise exception 'The approved draft and candidate must remain current.' using errcode='P0001'; end if;
  select * into v_candidate from public.content_page_candidates where public_id=p_candidate_id for update;
  if not found or v_draft.candidate_id <> p_candidate_id or v_draft.status <> 'editorial_ready' or v_candidate.status <> 'approved_for_draft' then raise exception 'The approved draft and candidate must remain current.' using errcode='P0001'; end if;
  select * into v_existing from public.content_publications where handoff_id=p_handoff_id for update;
  if found then return jsonb_build_object('publicationId',v_existing.public_id,'slug',v_existing.slug,'idempotentReplay',true); end if;
  insert into public.content_publications (public_id,handoff_id,draft_id,candidate_id,slug,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,evidence,publication_note,published_at,updated_at)
    values (p_publication_id,p_handoff_id,p_draft_id,p_candidate_id,p_slug,v_draft.title,v_draft.summary,v_draft.direct_answer,v_draft.method,v_draft.artifact_url,v_draft.artifact_label,v_draft.limitations,v_draft.editorial_reviewer,v_candidate.evidence,nullif(p_note,''),p_at,p_at);
  insert into public.content_publication_events (publication_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_publication_id,'published',p_idempotency_hash,p_actor_fingerprint,coalesce(nullif(p_note,''),'Human confirmed this public release after the score-qualified handoff.'),p_at);
  return jsonb_build_object('publicationId',p_publication_id,'slug',p_slug,'idempotentReplay',false);
end;
$$;

revoke all on function public.publish_content_page(text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.publish_content_page(text,text,text,text,text,text,text,text,timestamptz) to service_role;
