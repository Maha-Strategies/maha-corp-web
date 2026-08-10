-- Evidence-backed prospect research for Maha Navigator. This is an internal,
-- human-reviewed research ledger. It cannot send messages, create contacts in
-- third-party systems, or authorize outreach.

create table if not exists public.navigator_research_rubrics (
  rubric_key text not null check (rubric_key ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  version integer not null check (version > 0),
  name text not null check (char_length(name) between 3 and 160),
  definition jsonb not null,
  status text not null check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  primary key (rubric_key, version)
);

insert into public.navigator_research_rubrics (rubric_key, version, name, definition, status)
values (
  'maha-internal-icp', 1, 'Maha internal design-partner research rubric',
  $rubric${
    "idealAccountProfile": [
      "The account is deploying or piloting agent infrastructure, MCP, A2A, x402, or governed tool use.",
      "The deployment has a concrete governance, payment-safety, context-cost, auditability, or reliability problem Maha can test.",
      "A platform, AI infrastructure, security, engineering, or operations owner can sponsor a bounded assessment."
    ],
    "buyingTriggers": [
      "A public agent, MCP, A2A, wallet, payment, or multi-tool deployment launched or materially changed.",
      "The account published a security, audit, access-control, reliability, or agent-cost requirement.",
      "The account is hiring or assigning ownership for agent platform, AI security, infrastructure, or governance.",
      "A public incident, integration problem, or compliance commitment creates a dated reason to evaluate controls now."
    ],
    "disqualifiers": [
      "No evidence of a real or near-term agent deployment.",
      "No plausible sponsor or bounded workflow to assess.",
      "The evidence is stale, weak, contradictory, or relies on private inference.",
      "The account or person has asked not to be contacted, or contact would violate applicable platform rules or consent boundaries."
    ],
    "qualityGate": {
      "reviewedAccounts": 20,
      "minimumPursue": 10,
      "conversationWorthyDisposition": "pursue"
    }
  }$rubric$::jsonb,
  'active'
) on conflict (rubric_key, version) do nothing;

create table if not exists public.navigator_research_candidates (
  public_id text primary key check (public_id ~ '^navacct_[a-f0-9]{32}$'),
  company_name text not null check (char_length(company_name) between 2 and 160),
  company_domain text not null check (char_length(company_domain) between 3 and 253),
  rubric_key text not null,
  rubric_version integer not null,
  disposition text not null default 'unreviewed' check (disposition in ('unreviewed','pursue','watch','reject','insufficient_evidence','deferred')),
  latest_review_rationale text,
  benchmark_position integer unique check (benchmark_position between 1 and 20),
  created_by_fingerprint text not null check (created_by_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rubric_key, rubric_version) references public.navigator_research_rubrics(rubric_key, version)
);

create table if not exists public.navigator_research_claims (
  public_id text primary key check (public_id ~ '^navclm_[a-f0-9]{32}$'),
  candidate_id text not null references public.navigator_research_candidates(public_id) on delete restrict,
  claim_type text not null check (claim_type in ('account_fit','buying_trigger','likely_owner','disqualifier')),
  statement text not null check (char_length(statement) between 10 and 1500),
  source_url text not null check (source_url ~ '^https://'),
  source_published_on date,
  observed_on date not null,
  source_quality text not null check (source_quality in ('primary','credible_secondary','weak_or_ambiguous')),
  evidence_freshness text not null check (evidence_freshness in ('current','aging','stale','unknown')),
  confidence text not null check (confidence in ('low','medium','high')),
  supersedes_claim_id text references public.navigator_research_claims(public_id) on delete restrict,
  created_by_fingerprint text not null check (created_by_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (supersedes_claim_id)
);

create table if not exists public.navigator_research_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.navigator_research_candidates(public_id) on delete restrict,
  action text not null check (action in ('created','reviewed','challenged')),
  previous_disposition text check (previous_disposition is null or previous_disposition in ('unreviewed','pursue','watch','reject','insufficient_evidence','deferred')),
  new_disposition text check (new_disposition is null or new_disposition in ('unreviewed','pursue','watch','reject','insufficient_evidence','deferred')),
  challenged_claim_id text references public.navigator_research_claims(public_id) on delete restrict,
  rationale text check (rationale is null or char_length(rationale) between 1 and 3000),
  rubric_key text not null,
  rubric_version integer not null,
  evidence_snapshot jsonb not null,
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (rubric_key, rubric_version) references public.navigator_research_rubrics(rubric_key, version)
);

create index if not exists navigator_research_queue_idx on public.navigator_research_candidates (disposition, created_at asc);
create index if not exists navigator_research_claims_candidate_idx on public.navigator_research_claims (candidate_id, created_at asc);
create index if not exists navigator_research_events_candidate_idx on public.navigator_research_events (candidate_id, created_at asc);

alter table public.navigator_research_rubrics enable row level security;
alter table public.navigator_research_candidates enable row level security;
alter table public.navigator_research_claims enable row level security;
alter table public.navigator_research_events enable row level security;
revoke all on table public.navigator_research_rubrics, public.navigator_research_candidates, public.navigator_research_claims, public.navigator_research_events from public, anon, authenticated;
grant select on table public.navigator_research_rubrics, public.navigator_research_candidates, public.navigator_research_claims, public.navigator_research_events to service_role;
revoke insert, update, delete, truncate on table public.navigator_research_rubrics, public.navigator_research_candidates, public.navigator_research_claims, public.navigator_research_events from service_role;

create or replace function public.create_navigator_research_candidate(
  p_candidate_id text, p_company_name text, p_company_domain text,
  p_rubric_key text, p_rubric_version integer, p_claims jsonb,
  p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb; v_types text[] := '{}'; v_existing text;
begin
  if p_candidate_id !~ '^navacct_[a-f0-9]{32}$'
    or char_length(coalesce(p_company_name,'')) not between 2 and 160
    or char_length(coalesce(p_company_domain,'')) not between 3 and 253
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
    or p_at is null or jsonb_typeof(p_claims) <> 'array' or jsonb_array_length(p_claims) <> 4
  then raise exception 'Invalid Navigator research candidate.' using errcode='22023'; end if;

  select candidate_id into v_existing from public.navigator_research_events where idempotency_hash=p_idempotency_hash;
  if found then return jsonb_build_object('candidateId',v_existing,'idempotentReplay',true); end if;
  if not exists(select 1 from public.navigator_research_rubrics where rubric_key=p_rubric_key and version=p_rubric_version and status='active') then raise exception 'Navigator rubric not found.' using errcode='P0002'; end if;

  insert into public.navigator_research_candidates (public_id,company_name,company_domain,rubric_key,rubric_version,created_by_fingerprint,created_at,updated_at)
  values (p_candidate_id,p_company_name,p_company_domain,p_rubric_key,p_rubric_version,p_actor_fingerprint,p_at,p_at);

  for c in select value from jsonb_array_elements(p_claims) loop
    if coalesce(c->>'type','') not in ('account_fit','buying_trigger','likely_owner','disqualifier')
      or (c->>'type') = any(v_types)
      or coalesce(c->>'publicId','') !~ '^navclm_[a-f0-9]{32}$'
      or char_length(coalesce(c->>'statement','')) not between 10 and 1500
      or coalesce(c->>'sourceUrl','') !~ '^https://'
      or coalesce(c->>'sourceQuality','') not in ('primary','credible_secondary','weak_or_ambiguous')
      or coalesce(c->>'freshness','') not in ('current','aging','stale','unknown')
      or coalesce(c->>'confidence','') not in ('low','medium','high')
      or coalesce(c->>'observedOn','') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception 'Invalid Navigator research claim.' using errcode='22023'; end if;
    v_types := array_append(v_types,c->>'type');
    insert into public.navigator_research_claims (public_id,candidate_id,claim_type,statement,source_url,source_published_on,observed_on,source_quality,evidence_freshness,confidence,created_by_fingerprint,created_at)
    values (c->>'publicId',p_candidate_id,c->>'type',c->>'statement',c->>'sourceUrl',nullif(c->>'sourcePublishedOn','')::date,(c->>'observedOn')::date,c->>'sourceQuality',c->>'freshness',c->>'confidence',p_actor_fingerprint,p_at);
  end loop;
  if not (v_types @> array['account_fit','buying_trigger','likely_owner','disqualifier']) then raise exception 'Navigator claims are incomplete.' using errcode='22023'; end if;

  insert into public.navigator_research_events (candidate_id,action,previous_disposition,new_disposition,rubric_key,rubric_version,evidence_snapshot,actor_fingerprint,idempotency_hash,created_at)
  values (p_candidate_id,'created',null,'unreviewed',p_rubric_key,p_rubric_version,p_claims,p_actor_fingerprint,p_idempotency_hash,p_at);
  return jsonb_build_object('candidateId',p_candidate_id,'idempotentReplay',false);
end; $$;

create or replace function public.operate_navigator_research_candidate(
  p_candidate_id text, p_action text, p_disposition text, p_rationale text,
  p_challenged_claim_id text, p_idempotency_hash text, p_actor_fingerprint text, p_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.navigator_research_candidates%rowtype; v_snapshot jsonb; v_position integer; v_event public.navigator_research_events%rowtype;
begin
  if p_candidate_id !~ '^navacct_[a-f0-9]{32}$'
    or p_action not in ('review','challenge')
    or char_length(coalesce(p_rationale,'')) not between 1 and 3000
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$' or p_at is null
  then raise exception 'Invalid Navigator research operation.' using errcode='22023'; end if;
  select * into v_event from public.navigator_research_events where idempotency_hash=p_idempotency_hash;
  if found then return jsonb_build_object('candidateId',v_event.candidate_id,'disposition',v_event.new_disposition,'idempotentReplay',true); end if;
  select * into v from public.navigator_research_candidates where public_id=p_candidate_id for update;
  if not found then raise exception 'Navigator candidate not found.' using errcode='P0002'; end if;
  if p_action='review' and coalesce(p_disposition,'') not in ('pursue','watch','reject','insufficient_evidence','deferred') then raise exception 'Invalid Navigator disposition.' using errcode='22023'; end if;
  if p_action='challenge' and (p_challenged_claim_id is null or not exists(select 1 from public.navigator_research_claims where public_id=p_challenged_claim_id and candidate_id=p_candidate_id)) then raise exception 'Navigator claim not found.' using errcode='P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'publicId',public_id,'type',claim_type,'statement',statement,'sourceUrl',source_url,
    'sourcePublishedOn',source_published_on,'observedOn',observed_on,'sourceQuality',source_quality,
    'freshness',evidence_freshness,'confidence',confidence,'createdAt',created_at
  ) order by created_at, public_id),'[]'::jsonb) into v_snapshot from public.navigator_research_claims where candidate_id=p_candidate_id;

  if p_action='review' then
    v_position := v.benchmark_position;
    if v_position is null then
      perform pg_advisory_xact_lock(hashtext('navigator-research-benchmark-v1'));
      select count(*) + 1 into v_position from public.navigator_research_candidates where benchmark_position is not null;
      if v_position > 20 then v_position := null; end if;
    end if;
    update public.navigator_research_candidates set disposition=p_disposition,latest_review_rationale=p_rationale,
      benchmark_position=coalesce(benchmark_position,v_position),reviewed_at=p_at,updated_at=p_at where public_id=p_candidate_id;
    insert into public.navigator_research_events (candidate_id,action,previous_disposition,new_disposition,rationale,rubric_key,rubric_version,evidence_snapshot,actor_fingerprint,idempotency_hash,created_at)
    values (p_candidate_id,'reviewed',v.disposition,p_disposition,p_rationale,v.rubric_key,v.rubric_version,v_snapshot,p_actor_fingerprint,p_idempotency_hash,p_at);
    return jsonb_build_object('candidateId',p_candidate_id,'disposition',p_disposition,'benchmarkPosition',v_position,'idempotentReplay',false);
  end if;

  insert into public.navigator_research_events (candidate_id,action,previous_disposition,new_disposition,challenged_claim_id,rationale,rubric_key,rubric_version,evidence_snapshot,actor_fingerprint,idempotency_hash,created_at)
  values (p_candidate_id,'challenged',v.disposition,v.disposition,p_challenged_claim_id,p_rationale,v.rubric_key,v.rubric_version,v_snapshot,p_actor_fingerprint,p_idempotency_hash,p_at);
  return jsonb_build_object('candidateId',p_candidate_id,'disposition',v.disposition,'challengedClaimId',p_challenged_claim_id,'idempotentReplay',false);
end; $$;

revoke all on function public.create_navigator_research_candidate(text,text,text,text,integer,jsonb,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.operate_navigator_research_candidate(text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_navigator_research_candidate(text,text,text,text,integer,jsonb,text,text,timestamptz) to service_role;
grant execute on function public.operate_navigator_research_candidate(text,text,text,text,text,text,text,timestamptz) to service_role;

comment on table public.navigator_research_events is 'Append-only reviewer challenge and disposition history. Evidence snapshots preserve what the reviewer saw under the recorded rubric version.';
comment on column public.navigator_research_candidates.benchmark_position is 'Immutable cohort position assigned at first human review for the initial 20-account quality gate.';
