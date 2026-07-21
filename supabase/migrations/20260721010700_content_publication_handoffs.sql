-- A human publication handoff is an auditable review package only. It does
-- not create a route, update a sitemap, or grant publication authority.

create table if not exists public.content_publication_handoffs (
  public_id text primary key check (public_id ~ '^contenthandoff_[a-f0-9]{32}$'),
  draft_id text not null unique references public.content_page_drafts(public_id) on delete restrict,
  candidate_id text not null references public.content_page_candidates(public_id) on delete restrict,
  release_score integer not null check (release_score between 0 and 100),
  decision text not null check (decision in ('ready_for_human_publish','withheld')),
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_publication_handoff_events (
  id uuid primary key default gen_random_uuid(),
  handoff_id text not null references public.content_publication_handoffs(public_id) on delete restrict,
  action text not null check (action = 'prepared'),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (handoff_id, idempotency_hash)
);

create index if not exists content_publication_handoffs_decision_idx on public.content_publication_handoffs (decision, release_score desc, created_at asc);
alter table public.content_publication_handoffs enable row level security;
alter table public.content_publication_handoff_events enable row level security;
revoke all on table public.content_publication_handoffs, public.content_publication_handoff_events from public, anon, authenticated;
grant select, insert, update on table public.content_publication_handoffs to service_role;
grant select, insert on table public.content_publication_handoff_events to service_role;

create or replace function public.prepare_content_publication_handoff(
  p_handoff_id text, p_draft_id text, p_candidate_id text, p_release_score integer, p_decision text, p_checklist jsonb,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_candidate public.content_page_candidates%rowtype; v_existing public.content_publication_handoffs%rowtype;
begin
  if p_handoff_id !~ '^contenthandoff_[a-f0-9]{32}$' or p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or p_release_score not between 0 and 100 or p_decision not in ('ready_for_human_publish','withheld') or jsonb_typeof(p_checklist) <> 'object'
    or (p_release_score >= 70 and p_decision <> 'ready_for_human_publish') or (p_release_score < 70 and p_decision <> 'withheld')
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid publication handoff.' using errcode='22023'; end if;
  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found or v_draft.candidate_id <> p_candidate_id or v_draft.status <> 'editorial_ready' then raise exception 'An editorial-ready draft is required.' using errcode='P0001'; end if;
  select * into v_candidate from public.content_page_candidates where public_id=p_candidate_id for update;
  if not found or v_candidate.status <> 'approved_for_draft' then raise exception 'The evidence candidate is not approved.' using errcode='P0001'; end if;
  select * into v_existing from public.content_publication_handoffs where draft_id=p_draft_id for update;
  if found then return jsonb_build_object('handoffId',v_existing.public_id,'decision',v_existing.decision,'idempotentReplay',true); end if;
  insert into public.content_publication_handoffs (public_id,draft_id,candidate_id,release_score,decision,checklist,created_at,updated_at)
    values (p_handoff_id,p_draft_id,p_candidate_id,p_release_score,p_decision,p_checklist,p_at,p_at);
  insert into public.content_publication_handoff_events (handoff_id,action,idempotency_hash,actor_fingerprint,note,created_at)
    values (p_handoff_id,'prepared',p_idempotency_hash,p_actor_fingerprint,'Handoff prepared. This is not a publication authorization or page creation.',p_at);
  return jsonb_build_object('handoffId',p_handoff_id,'decision',p_decision,'idempotentReplay',false);
end;
$$;

revoke all on function public.prepare_content_publication_handoff(text,text,text,integer,text,jsonb,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.prepare_content_publication_handoff(text,text,text,integer,text,jsonb,text,text,timestamptz) to service_role;
