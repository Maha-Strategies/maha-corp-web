-- Revisions preserve the original private draft and invalidate prior handoffs.
-- They do not create public content or grant publication authority.

alter table public.content_page_drafts add column if not exists revision integer not null default 1 check (revision >= 1);
alter table public.content_publication_handoffs add column if not exists superseded_at timestamptz;

create table if not exists public.content_page_draft_revisions (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null references public.content_page_drafts(public_id) on delete restrict,
  revision integer not null check (revision >= 1),
  title text not null,
  summary text not null,
  direct_answer text not null,
  method text not null,
  artifact_url text,
  artifact_label text,
  limitations text,
  editorial_reviewer text not null,
  status text not null check (status in ('draft','editorial_ready','archived')),
  created_at timestamptz not null,
  unique (draft_id, revision)
);

insert into public.content_page_draft_revisions (draft_id,revision,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status,created_at)
select public_id,revision,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status,created_at
from public.content_page_drafts
on conflict (draft_id, revision) do nothing;

alter table public.content_page_draft_events drop constraint if exists content_page_draft_events_action_check;
alter table public.content_page_draft_events add constraint content_page_draft_events_action_check check (action in ('composed','revise','mark_editorial_ready','archive'));

create or replace function public.revise_content_page_draft(
  p_draft_id text, p_candidate_id text, p_title text, p_summary text, p_direct_answer text, p_method text,
  p_artifact_url text, p_artifact_label text, p_limitations text, p_editorial_reviewer text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_revision integer;
begin
  if p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or char_length(p_title) not between 20 and 160 or char_length(p_summary) not between 80 and 600
    or char_length(p_direct_answer) not between 120 and 1800 or char_length(p_method) not between 120 and 2400
    or char_length(p_editorial_reviewer) not between 3 and 160
    or (p_artifact_url is null) <> (p_artifact_label is null) or (p_artifact_url is not null and p_artifact_url !~ '^https://')
    or (p_artifact_label is not null and char_length(p_artifact_label) not between 3 and 200)
    or (p_limitations is not null and char_length(p_limitations) not between 40 and 1800)
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid content draft revision.' using errcode='22023'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found or v_draft.candidate_id <> p_candidate_id then raise exception 'Content draft not found.' using errcode='P0002'; end if;
  if v_draft.status not in ('draft','editorial_ready') then raise exception 'This draft cannot be revised in its current state.' using errcode='P0001'; end if;
  if exists(select 1 from public.content_page_draft_events where draft_id=p_draft_id and idempotency_hash=p_idempotency_hash) then return jsonb_build_object('draftId',p_draft_id,'revision',v_draft.revision,'status',v_draft.status,'idempotentReplay',true); end if;
  v_revision := v_draft.revision + 1;
  update public.content_page_drafts set title=p_title,summary=p_summary,direct_answer=p_direct_answer,method=p_method,artifact_url=nullif(p_artifact_url,''),artifact_label=nullif(p_artifact_label,''),limitations=nullif(p_limitations,''),editorial_reviewer=p_editorial_reviewer,revision=v_revision,status='draft',reviewer_note=null,updated_at=p_at where public_id=p_draft_id;
  insert into public.content_page_draft_revisions (draft_id,revision,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status,created_at)
    values (p_draft_id,v_revision,p_title,p_summary,p_direct_answer,p_method,nullif(p_artifact_url,''),nullif(p_artifact_label,''),nullif(p_limitations,''),p_editorial_reviewer,'draft',p_at);
  update public.content_publication_handoffs set superseded_at=p_at,updated_at=p_at where draft_id=p_draft_id and superseded_at is null;
  insert into public.content_page_draft_events (draft_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_draft_id,'revise',p_idempotency_hash,p_actor_fingerprint,'New private draft revision saved; prior publication handoffs superseded.',p_at);
  return jsonb_build_object('draftId',p_draft_id,'revision',v_revision,'status','draft','idempotentReplay',false);
end;
$$;

create or replace function public.prepare_content_publication_handoff(
  p_handoff_id text, p_draft_id text, p_candidate_id text, p_release_score integer, p_decision text, p_checklist jsonb,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_candidate public.content_page_candidates%rowtype; v_existing public.content_publication_handoffs%rowtype; v_required boolean;
begin
  v_required := p_checklist @> '{"summaryComplete":true,"mahaMethodComplete":true,"limitsIncluded":true,"evidenceArtifactIncluded":true}'::jsonb;
  if p_handoff_id !~ '^contenthandoff_[a-f0-9]{32}$' or p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or p_release_score not between 0 and 100 or p_decision not in ('ready_for_human_publish','withheld') or jsonb_typeof(p_checklist) <> 'object'
    or (p_release_score >= 70 and v_required and p_decision <> 'ready_for_human_publish') or ((p_release_score < 70 or not v_required) and p_decision <> 'withheld')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid publication handoff.' using errcode='22023'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found or v_draft.candidate_id <> p_candidate_id or v_draft.status <> 'editorial_ready' then raise exception 'An editorial-ready draft is required.' using errcode='P0001'; end if;
  select * into v_candidate from public.content_page_candidates where public_id=p_candidate_id for update;
  if not found or v_candidate.status <> 'approved_for_draft' then raise exception 'The evidence candidate is not approved.' using errcode='P0001'; end if;
  select * into v_existing from public.content_publication_handoffs where draft_id=p_draft_id and superseded_at is null for update;
  if found then return jsonb_build_object('handoffId',v_existing.public_id,'decision',v_existing.decision,'idempotentReplay',true); end if;
  insert into public.content_publication_handoffs (public_id,draft_id,candidate_id,release_score,decision,checklist,created_at,updated_at)
    values (p_handoff_id,p_draft_id,p_candidate_id,p_release_score,p_decision,p_checklist,p_at,p_at);
  insert into public.content_publication_handoff_events (handoff_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_handoff_id,'prepared',p_idempotency_hash,p_actor_fingerprint,'Handoff prepared. This is not a publication authorization or page creation.',p_at);
  return jsonb_build_object('handoffId',p_handoff_id,'decision',p_decision,'idempotentReplay',false);
end;
$$;

revoke all on function public.revise_content_page_draft(text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.revise_content_page_draft(text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
