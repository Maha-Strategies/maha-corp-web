-- Editorial fact-check reviews: an auditable, human-gated evidence-quality layer
-- that sits BEFORE the publication handoff. It records claim classifications and
-- human resolutions; it never asserts truth, never creates a route, and never
-- grants publication authority. A review with open high-risk (contradicted /
-- insufficient_evidence) claims — or without a human acknowledgement — supersedes
-- any active handoff for the draft, so a stale handoff cannot be published.

create table if not exists public.content_fact_check_reviews (
  public_id text primary key check (public_id ~ '^contentfc_[a-f0-9]{32}$'),
  draft_id text not null references public.content_page_drafts(public_id) on delete restrict,
  candidate_id text not null references public.content_page_candidates(public_id) on delete restrict,
  readiness_score integer not null check (readiness_score between 0 and 100),
  claim_count integer not null check (claim_count between 0 and 40),
  high_risk_count integer not null default 0 check (high_risk_count >= 0),
  status text not null default 'open' check (status in ('open', 'acknowledged')),
  acknowledged_at timestamptz,
  acknowledged_by text check (acknowledged_by is null or acknowledged_by ~ '^sha256:[a-f0-9]{64}$'),
  acknowledgement_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz
);
create unique index if not exists content_fact_check_reviews_active_draft_idx on public.content_fact_check_reviews (draft_id) where superseded_at is null;

create table if not exists public.content_fact_check_claims (
  id uuid primary key default gen_random_uuid(),
  review_id text not null references public.content_fact_check_reviews(public_id) on delete restrict,
  claim_index integer not null check (claim_index between 0 and 39),
  claim_text text not null check (char_length(claim_text) between 8 and 600),
  classification text not null check (classification in ('supported', 'insufficient_evidence', 'contradicted', 'interpretation', 'time_sensitive')),
  required_action text not null check (required_action in ('retain_with_attribution', 'qualify', 'revise', 'remove', 'verify_manually')),
  rationale text not null check (char_length(rationale) between 3 and 1000),
  cited_urls jsonb not null check (jsonb_typeof(cited_urls) = 'array'),
  risk text not null check (risk in ('high', 'manual', 'interpretation', 'clear')),
  weak_evidence boolean not null default false,
  resolution text not null default 'open' check (resolution in ('open', 'resolved', 'accepted')),
  resolution_reason text check (resolution_reason is null or char_length(resolution_reason) between 3 and 2000),
  resolved_by text check (resolved_by is null or resolved_by ~ '^sha256:[a-f0-9]{64}$'),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (review_id, claim_index)
);
create index if not exists content_fact_check_claims_review_idx on public.content_fact_check_claims (review_id);

create table if not exists public.content_fact_check_events (
  id uuid primary key default gen_random_uuid(),
  review_id text not null references public.content_fact_check_reviews(public_id) on delete restrict,
  action text not null check (action in ('submitted', 'claim_resolved', 'claim_accepted', 'acknowledged')),
  idempotency_hash text not null check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (review_id, idempotency_hash)
);

alter table public.content_fact_check_reviews enable row level security;
alter table public.content_fact_check_claims enable row level security;
alter table public.content_fact_check_events enable row level security;
revoke all on table public.content_fact_check_reviews, public.content_fact_check_claims, public.content_fact_check_events from public, anon, authenticated;
grant select, insert, update on table public.content_fact_check_reviews to service_role;
grant select, insert, update on table public.content_fact_check_claims to service_role;
grant select, insert on table public.content_fact_check_events to service_role;

-- Record a review. Supersedes any prior active review AND any active handoff for
-- the draft, so the publish gate always reflects the latest fact-check. Idempotent
-- by the submission idempotency hash.
create or replace function public.record_content_fact_check(
  p_review_id text, p_draft_id text, p_candidate_id text, p_readiness_score integer, p_claims jsonb,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_draft public.content_page_drafts%rowtype; v_prior text; v_high integer; v_count integer;
begin
  if p_review_id !~ '^contentfc_[a-f0-9]{32}$' or p_draft_id !~ '^contentdraft_[a-f0-9]{32}$' or p_candidate_id !~ '^contentcand_[a-f0-9]{32}$'
    or p_readiness_score not between 0 and 100 or jsonb_typeof(p_claims) <> 'array' or jsonb_array_length(p_claims) not between 1 and 40
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid fact-check review.' using errcode='22023'; end if;

  -- Idempotent replay: the same submission returns the existing review.
  select review_id into v_prior from public.content_fact_check_events where idempotency_hash=p_idempotency_hash and action='submitted' limit 1;
  if v_prior is not null then
    select high_risk_count into v_high from public.content_fact_check_reviews where public_id=v_prior;
    return jsonb_build_object('reviewId',v_prior,'idempotentReplay',true,'highRiskOpen',coalesce(v_high,0));
  end if;

  select * into v_draft from public.content_page_drafts where public_id=p_draft_id for update;
  if not found or v_draft.candidate_id <> p_candidate_id then raise exception 'The draft and evidence candidate must match.' using errcode='P0001'; end if;

  -- Supersede the prior active review and any active handoff for this draft.
  update public.content_fact_check_reviews set superseded_at=p_at, updated_at=p_at where draft_id=p_draft_id and superseded_at is null;
  update public.content_publication_handoffs set superseded_at=p_at, updated_at=p_at where draft_id=p_draft_id and superseded_at is null;

  insert into public.content_fact_check_reviews (public_id, draft_id, candidate_id, readiness_score, claim_count, high_risk_count, status, created_at, updated_at)
    values (p_review_id, p_draft_id, p_candidate_id, p_readiness_score, jsonb_array_length(p_claims), 0, 'open', p_at, p_at);

  insert into public.content_fact_check_claims (review_id, claim_index, claim_text, classification, required_action, rationale, cited_urls, risk, weak_evidence)
  select p_review_id, (elem->>'index')::integer, elem->>'claimText', elem->>'classification', elem->>'requiredAction', elem->>'rationale',
         coalesce(elem->'citedUrls','[]'::jsonb), elem->>'risk', coalesce((elem->>'weakEvidence')::boolean, false)
  from jsonb_array_elements(p_claims) elem;

  select count(*) into v_high from public.content_fact_check_claims where review_id=p_review_id and risk='high' and resolution='open';
  select count(*) into v_count from public.content_fact_check_claims where review_id=p_review_id;
  update public.content_fact_check_reviews set high_risk_count=v_high, claim_count=v_count, updated_at=p_at where public_id=p_review_id;

  insert into public.content_fact_check_events (review_id, action, idempotency_hash, actor_fingerprint, note, created_at)
    values (p_review_id, 'submitted', p_idempotency_hash, p_actor_fingerprint, 'Fact-check recorded. This asserts evidence status only, never truth.', p_at);

  return jsonb_build_object('reviewId', p_review_id, 'idempotentReplay', false, 'highRiskOpen', v_high, 'readinessScore', p_readiness_score);
end;
$$;

-- A human resolves or accepts one claim, with a reason. Append-only, idempotent.
create or replace function public.resolve_content_fact_check_claim(
  p_review_id text, p_claim_index integer, p_resolution text, p_reason text,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_review public.content_fact_check_reviews%rowtype; v_high integer;
begin
  if p_review_id !~ '^contentfc_[a-f0-9]{32}$' or p_claim_index is null or p_claim_index < 0 or p_resolution not in ('resolved','accepted')
    or p_reason is null or char_length(p_reason) not between 3 and 2000
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid fact-check resolution.' using errcode='22023'; end if;

  if exists (select 1 from public.content_fact_check_events where review_id=p_review_id and idempotency_hash=p_idempotency_hash) then
    select high_risk_count into v_high from public.content_fact_check_reviews where public_id=p_review_id;
    return jsonb_build_object('reviewId',p_review_id,'claimIndex',p_claim_index,'idempotentReplay',true,'highRiskOpen',coalesce(v_high,0));
  end if;

  select * into v_review from public.content_fact_check_reviews where public_id=p_review_id and superseded_at is null for update;
  if not found then raise exception 'An active fact-check review is required.' using errcode='P0001'; end if;
  if not exists (select 1 from public.content_fact_check_claims where review_id=p_review_id and claim_index=p_claim_index) then
    raise exception 'The claim was not found.' using errcode='P0002'; end if;

  update public.content_fact_check_claims set resolution=p_resolution, resolution_reason=p_reason, resolved_by=p_actor_fingerprint, resolved_at=p_at
    where review_id=p_review_id and claim_index=p_claim_index;
  select count(*) into v_high from public.content_fact_check_claims where review_id=p_review_id and risk='high' and resolution='open';
  update public.content_fact_check_reviews set high_risk_count=v_high, updated_at=p_at where public_id=p_review_id;

  insert into public.content_fact_check_events (review_id, action, idempotency_hash, actor_fingerprint, note, created_at)
    values (p_review_id, case when p_resolution='accepted' then 'claim_accepted' else 'claim_resolved' end, p_idempotency_hash, p_actor_fingerprint, left(p_reason, 500), p_at);

  return jsonb_build_object('reviewId', p_review_id, 'claimIndex', p_claim_index, 'resolution', p_resolution, 'idempotentReplay', false, 'highRiskOpen', v_high);
end;
$$;

-- A human acknowledges the whole review. Only allowed once no high-risk claim is
-- open — acknowledgement cannot paper over unresolved contradicted/insufficient claims.
create or replace function public.acknowledge_content_fact_check(
  p_review_id text, p_note text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_review public.content_fact_check_reviews%rowtype;
begin
  if p_review_id !~ '^contentfc_[a-f0-9]{32}$' or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$' or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
    or (p_note is not null and char_length(p_note) > 2000)
  then raise exception 'Invalid fact-check acknowledgement.' using errcode='22023'; end if;

  if exists (select 1 from public.content_fact_check_events where review_id=p_review_id and idempotency_hash=p_idempotency_hash) then
    return jsonb_build_object('reviewId',p_review_id,'idempotentReplay',true,'acknowledged',true);
  end if;

  select * into v_review from public.content_fact_check_reviews where public_id=p_review_id and superseded_at is null for update;
  if not found then raise exception 'An active fact-check review is required.' using errcode='P0001'; end if;
  if v_review.high_risk_count > 0 then raise exception 'Unresolved high-risk claims must be resolved before acknowledgement.' using errcode='P0001'; end if;

  update public.content_fact_check_reviews set status='acknowledged', acknowledged_at=p_at, acknowledged_by=p_actor_fingerprint, acknowledgement_note=nullif(p_note,''), updated_at=p_at where public_id=p_review_id;
  insert into public.content_fact_check_events (review_id, action, idempotency_hash, actor_fingerprint, note, created_at)
    values (p_review_id, 'acknowledged', p_idempotency_hash, p_actor_fingerprint, 'Human acknowledged claim-verification readiness. Truth remains a human judgment.', p_at);

  return jsonb_build_object('reviewId', p_review_id, 'idempotentReplay', false, 'acknowledged', true);
end;
$$;

revoke all on function public.record_content_fact_check(text,text,text,integer,jsonb,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.resolve_content_fact_check_claim(text,integer,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.acknowledge_content_fact_check(text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_content_fact_check(text,text,text,integer,jsonb,text,text,timestamptz) to service_role;
grant execute on function public.resolve_content_fact_check_claim(text,integer,text,text,text,text,timestamptz) to service_role;
grant execute on function public.acknowledge_content_fact_check(text,text,text,text,timestamptz) to service_role;
