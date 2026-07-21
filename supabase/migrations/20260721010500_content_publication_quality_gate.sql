-- Evidence-first content candidate registry. This intentionally prepares no
-- public page and grants no publishing, deployment, spend, or outreach power.

create table if not exists public.content_page_candidates (
  public_id text primary key check (public_id ~ '^contentcand_[a-f0-9]{32}$'),
  topic_cluster text not null check (topic_cluster in ('mps_claim_verification','research_intelligence','document_data_extraction','receipt_operations','ai_infrastructure')),
  proposed_path text not null check (proposed_path ~ '^/[a-z0-9][a-z0-9/-]{1,180}$'),
  reader_question text not null check (char_length(reader_question) between 20 and 500),
  reader_outcome text not null check (char_length(reader_outcome) between 20 and 750),
  original_value text not null check (char_length(original_value) between 40 and 1500),
  author_attribution text not null check (char_length(author_attribution) between 3 and 160),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 3 and 5),
  policy_checks jsonb not null check (jsonb_typeof(policy_checks) = 'object'),
  quality_score integer not null check (quality_score between 0 and 100),
  status text not null check (status in ('evidence_collecting','draft_ready','approved_for_draft','noindex','rejected')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposed_path)
);

create table if not exists public.content_page_candidate_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.content_page_candidates(public_id) on delete restrict,
  action text not null check (action in ('created','approve_draft','withhold_noindex','reject')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (candidate_id, idempotency_hash)
);

create index if not exists content_page_candidates_queue_idx on public.content_page_candidates (status, quality_score desc, created_at asc);
create index if not exists content_page_candidate_events_candidate_idx on public.content_page_candidate_events (candidate_id, created_at asc);
alter table public.content_page_candidates enable row level security;
alter table public.content_page_candidate_events enable row level security;
revoke all on table public.content_page_candidates, public.content_page_candidate_events from public, anon, authenticated;
grant select, insert, update on table public.content_page_candidates to service_role;
grant select, insert on table public.content_page_candidate_events to service_role;

create or replace function public.create_content_page_candidate(
  p_candidate_id text, p_topic_cluster text, p_proposed_path text, p_reader_question text, p_reader_outcome text,
  p_original_value text, p_author_attribution text, p_evidence jsonb, p_policy_checks jsonb, p_quality_score integer,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_existing public.content_page_candidates%rowtype; v_status text;
begin
  if p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or p_topic_cluster not in ('mps_claim_verification','research_intelligence','document_data_extraction','receipt_operations','ai_infrastructure')
    or p_proposed_path !~ '^/[a-z0-9][a-z0-9/-]{1,180}$'
    or char_length(p_reader_question) not between 20 and 500 or char_length(p_reader_outcome) not between 20 and 750
    or char_length(p_original_value) not between 40 and 1500 or char_length(p_author_attribution) not between 3 and 160
    or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) not between 3 and 5
    or jsonb_typeof(p_policy_checks) <> 'object' or p_quality_score not between 0 and 100
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid content candidate.' using errcode='22023'; end if;

  select * into v_existing from public.content_page_candidates where proposed_path=p_proposed_path for update;
  if found then return jsonb_build_object('candidateId',v_existing.public_id,'status',v_existing.status,'idempotentReplay',true); end if;

  v_status := case when p_quality_score >= 70
    and p_policy_checks @> '{"readerFirst":true,"originalAnalysis":true,"notDoorway":true,"attributionComplete":true,"sourceIndependenceReviewed":true,"humanReviewRequired":true}'::jsonb
    then 'draft_ready' else 'evidence_collecting' end;

  insert into public.content_page_candidates (public_id,topic_cluster,proposed_path,reader_question,reader_outcome,original_value,author_attribution,evidence,policy_checks,quality_score,status,created_at,updated_at)
    values (p_candidate_id,p_topic_cluster,p_proposed_path,p_reader_question,p_reader_outcome,p_original_value,p_author_attribution,p_evidence,p_policy_checks,p_quality_score,v_status,p_at,p_at);
  insert into public.content_page_candidate_events (candidate_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_candidate_id,'created',p_idempotency_hash,p_actor_fingerprint,'Candidate recorded. No public page was created.',p_at);
  return jsonb_build_object('candidateId',p_candidate_id,'status',v_status,'idempotentReplay',false);
end;
$$;

create or replace function public.operate_content_page_candidate(
  p_candidate_id text, p_action text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_candidate public.content_page_candidates%rowtype; v_status text;
begin
  if p_candidate_id !~ '^contentcand_[a-f0-9]{32}$' or p_action not in ('approve_draft','withhold_noindex','reject')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000)
  then raise exception 'Invalid content candidate operation.' using errcode='22023'; end if;
  select * into v_candidate from public.content_page_candidates where public_id=p_candidate_id for update;
  if not found then raise exception 'Content candidate not found.' using errcode='P0002'; end if;
  if exists(select 1 from public.content_page_candidate_events where candidate_id=p_candidate_id and idempotency_hash=p_idempotency_hash) then
    return jsonb_build_object('candidateId',p_candidate_id,'status',v_candidate.status,'idempotentReplay',true);
  end if;
  v_status := case p_action when 'approve_draft' then 'approved_for_draft' when 'withhold_noindex' then 'noindex' else 'rejected' end;
  if not ((p_action='approve_draft' and v_candidate.status='draft_ready') or (p_action in ('withhold_noindex','reject') and v_candidate.status in ('evidence_collecting','draft_ready'))) then
    raise exception 'Operation is not allowed for the current content state.' using errcode='P0001';
  end if;
  insert into public.content_page_candidate_events (candidate_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_candidate_id,p_action,p_idempotency_hash,p_actor_fingerprint,nullif(p_note,''),p_at);
  update public.content_page_candidates set status=v_status, reviewer_note=nullif(p_note,''), updated_at=p_at where public_id=p_candidate_id;
  return jsonb_build_object('candidateId',p_candidate_id,'status',v_status,'idempotentReplay',false);
end;
$$;

revoke all on function public.create_content_page_candidate(text,text,text,text,text,text,text,jsonb,jsonb,integer,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.operate_content_page_candidate(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_content_page_candidate(text,text,text,text,text,text,text,jsonb,jsonb,integer,text,text,timestamptz) to service_role;
grant execute on function public.operate_content_page_candidate(text,text,text,text,text,timestamptz) to service_role;
