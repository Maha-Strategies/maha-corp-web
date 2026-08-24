-- Phase 4A: a bounded cross-domain pilot and one-time, exact-hash reviewer
-- invitations. Invitation credentials never enter these ledgers: only their
-- SHA-256 digests are retained. An invitation grants one reviewer profile one
-- review scope on one latest pilot target and cannot publish content.

create table if not exists public.epistemic_phase4_pilot_entries (
  manifest_version text not null check (manifest_version = 'maha-phase4-pilot/1.0'),
  sequence integer not null check (sequence between 1 and 20),
  candidate_record_id text not null check (candidate_record_id ~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'),
  domain_slug text not null check (domain_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 240),
  source_public_path text not null check (source_public_path ~ '^/knowledge/[a-z0-9/_-]+$'),
  selection_rationale text not null check (char_length(selection_rationale) between 20 and 1000),
  created_at timestamptz not null default now(),
  primary key (manifest_version, candidate_record_id),
  unique (manifest_version, sequence)
);

insert into public.epistemic_phase4_pilot_entries
  (manifest_version, sequence, candidate_record_id, domain_slug, title, source_public_path, selection_rationale)
values
  ('maha-phase4-pilot/1.0', 1, 'urn:maha:record:legacy-semiconductor-direct-to-silicon-liquid-cooling', 'semiconductor', 'Direct-to-Silicon Liquid Cooling: Architecture and Qualification', '/knowledge/concepts/direct-to-silicon-liquid-cooling', 'A commercially relevant systems record with a small, concrete evidence-completion surface.'),
  ('maha-phase4-pilot/1.0', 2, 'urn:maha:record:legacy-semiconductor-ion-implantation-and-annealing', 'semiconductor', 'Ion Implantation and Annealing: How Semiconductor Regions Are Doped', '/knowledge/processes/ion-implantation-and-annealing', 'A process-mechanism record that tests condition, equipment, and transfer boundaries.'),
  ('maha-phase4-pilot/1.0', 3, 'urn:maha:record:legacy-semiconductor-plasma-etch-and-pattern-transfer', 'semiconductor', 'Plasma Etch and Pattern Transfer: Turning Resist Images Into Structures', '/knowledge/processes/plasma-etch-and-pattern-transfer', 'A process-mechanism record with material scope and metrology dependencies.'),
  ('maha-phase4-pilot/1.0', 4, 'urn:maha:record:legacy-semiconductor-semiconductor-metrology-and-defect-inspection', 'semiconductor', 'Semiconductor Metrology and Defect Inspection', '/knowledge/concepts/semiconductor-metrology-and-defect-inspection', 'A measurement record that tests uncertainty and instrument-specific claims.'),
  ('maha-phase4-pilot/1.0', 5, 'urn:maha:record:legacy-mathematics-bayesian-updating', 'mathematics', 'Bayesian updating', '/knowledge/mathematics/bayesian-updating', 'A formal concept needed by later evidence updating and calibration work.'),
  ('maha-phase4-pilot/1.0', 6, 'urn:maha:record:legacy-mathematics-calibration-and-reliability', 'mathematics', 'Calibration and reliability', '/knowledge/mathematics/calibration-and-reliability', 'A method record that connects prediction quality to measurable reliability.'),
  ('maha-phase4-pilot/1.0', 7, 'urn:maha:record:legacy-mathematics-causal-inference', 'mathematics', 'Causal inference and counterfactuals', '/knowledge/mathematics/causal-inference', 'A boundary-critical concept separating association, intervention, and causal claims.'),
  ('maha-phase4-pilot/1.0', 8, 'urn:maha:record:legacy-mathematics-formal-logic-and-rule-compilation', 'mathematics', 'Formal logic and rule compilation', '/knowledge/mathematics/formal-logic-and-rule-compilation', 'A method record that tests executable formalization without transferring truth from syntax.'),
  ('maha-phase4-pilot/1.0', 9, 'urn:maha:record:legacy-astronomy-orbits-gravity-and-ephemerides', 'astronomy', 'Orbits, Gravity, and Ephemerides', '/knowledge/astronomy/orbits-gravity-and-ephemerides', 'A mechanistic record joining observation, physical model, and reproducible calculation.'),
  ('maha-phase4-pilot/1.0', 10, 'urn:maha:record:legacy-astronomy-telescopes-detectors-and-angular-resolution', 'astronomy', 'Telescopes, Detectors, and Angular Resolution', '/knowledge/astronomy/telescopes-detectors-and-angular-resolution', 'An instrumentation record with explicit resolution and measurement limits.'),
  ('maha-phase4-pilot/1.0', 11, 'urn:maha:record:legacy-astronomy-cosmic-microwave-background-and-lambda-cdm', 'astronomy', 'The Cosmic Microwave Background and Lambda-CDM', '/knowledge/astronomy/cosmic-microwave-background-and-lambda-cdm', 'A model-comparison record with inferential and uncertainty boundaries.'),
  ('maha-phase4-pilot/1.0', 12, 'urn:maha:record:legacy-astronomy-exoplanet-detection-and-confirmation', 'astronomy', 'Exoplanet Detection, Validation, and Confirmation', '/knowledge/astronomy/exoplanet-detection-and-confirmation', 'A method record that distinguishes detection, validation, and confirmation.'),
  ('maha-phase4-pilot/1.0', 13, 'urn:maha:record:legacy-religion-textual-authority', 'religion', 'Textual authority', '/knowledge/religion/textual-authority', 'A methodological record separating documentary authority from empirical truth.'),
  ('maha-phase4-pilot/1.0', 14, 'urn:maha:record:legacy-religion-translation-and-semantic-range', 'religion', 'Translation and semantic range', '/knowledge/religion/translation-and-semantic-range', 'A source-fidelity record that makes edition and translation disagreement material.'),
  ('maha-phase4-pilot/1.0', 15, 'urn:maha:record:legacy-religion-historical-evidence', 'religion', 'Historical evidence', '/knowledge/religion/historical-evidence', 'A methodological record separating historical inference from theology and lived practice.'),
  ('maha-phase4-pilot/1.0', 16, 'urn:maha:record:legacy-religion-empirical-claims-and-study-design', 'religion', 'Empirical claims and study design', '/knowledge/religion/empirical-claims-and-study-design', 'A comparison boundary for claims that can and cannot enter empirical testing.'),
  ('maha-phase4-pilot/1.0', 17, 'urn:maha:record:legacy-neuromorphic-biocomputing-in-memory-and-memristive-computing', 'neuromorphic-biocomputing', 'In-memory and memristive computing', '/knowledge/neuromorphic-biocomputing/in-memory-and-memristive-computing', 'A hardware record that tests benchmark and substrate-transfer claims.'),
  ('maha-phase4-pilot/1.0', 18, 'urn:maha:record:legacy-neuromorphic-biocomputing-molecular-and-dna-computing', 'neuromorphic-biocomputing', 'Molecular and DNA computing', '/knowledge/neuromorphic-biocomputing/molecular-and-dna-computing', 'A non-silicon mechanism record with laboratory and scaling boundaries.'),
  ('maha-phase4-pilot/1.0', 19, 'urn:maha:record:legacy-neuromorphic-biocomputing-physical-reservoir-computing', 'neuromorphic-biocomputing', 'Physical reservoir computing', '/knowledge/neuromorphic-biocomputing/physical-reservoir-computing', 'A cross-substrate record requiring careful task and performance equivalence.'),
  ('maha-phase4-pilot/1.0', 20, 'urn:maha:record:legacy-neuromorphic-biocomputing-synthetic-biological-circuits', 'neuromorphic-biocomputing', 'Synthetic biological circuits', '/knowledge/neuromorphic-biocomputing/synthetic-biological-circuits', 'A biological-computation record with strong safety and readiness boundaries.')
on conflict do nothing;

create table if not exists public.epistemic_reviewer_invitations (
  invitation_id text primary key check (invitation_id ~ '^epiinvite_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-review-invitation/1.0'),
  pilot_manifest_version text not null,
  candidate_record_id text not null,
  domain_slug text not null,
  target_sha256 text not null check (target_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  review_scope text not null check (review_scope in ('source-fidelity','domain-fidelity','boundary-adequacy','rights-and-locator')),
  reviewer_id text not null check (reviewer_id ~ '^expert_[a-z0-9][a-z0-9_-]{6,63}$'),
  reviewer_profile_version integer not null check (reviewer_profile_version > 0),
  reviewer_profile_sha256 text not null check (reviewer_profile_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  reviewer_profile_snapshot jsonb not null check (jsonb_typeof(reviewer_profile_snapshot) = 'object'),
  token_sha256 text not null unique check (token_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  note text not null check (char_length(note) between 20 and 1000),
  expires_at timestamptz not null,
  invitation_sha256 text not null unique check (invitation_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  invitation_snapshot jsonb not null check (jsonb_typeof(invitation_snapshot) = 'object'),
  invited_by_fingerprint text not null check (invited_by_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null,
  foreign key (pilot_manifest_version, candidate_record_id)
    references public.epistemic_phase4_pilot_entries(manifest_version, candidate_record_id)
);

create table if not exists public.epistemic_reviewer_invitation_events (
  event_id text primary key check (event_id ~ '^epiinviteevent_[a-f0-9]{32}$'),
  schema_version text not null check (schema_version = 'maha-epistemic-review-invitation-event/1.0'),
  invitation_id text not null unique references public.epistemic_reviewer_invitations(invitation_id),
  action text not null check (action in ('consume','revoke')),
  review_id text references public.epistemic_expert_review_decisions(review_id),
  reason text not null check (char_length(reason) between 20 and 1000),
  event_sha256 text not null unique check (event_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  event_snapshot jsonb not null check (jsonb_typeof(event_snapshot) = 'object'),
  actor_fingerprint text not null check (actor_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  idempotency_hash text not null unique check (idempotency_hash ~ '^sha256:[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((action = 'consume' and review_id is not null) or (action = 'revoke' and review_id is null))
);

create index if not exists epistemic_reviewer_invitation_target_idx
  on public.epistemic_reviewer_invitations (candidate_record_id, target_sha256, review_scope, created_at desc);
create index if not exists epistemic_reviewer_invitation_expiry_idx
  on public.epistemic_reviewer_invitations (expires_at);

create trigger epistemic_phase4_pilot_entries_immutable
  before update or delete on public.epistemic_phase4_pilot_entries
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_reviewer_invitations_immutable
  before update or delete on public.epistemic_reviewer_invitations
  for each row execute function public.reject_epistemic_ledger_mutation();
create trigger epistemic_reviewer_invitation_events_immutable
  before update or delete on public.epistemic_reviewer_invitation_events
  for each row execute function public.reject_epistemic_ledger_mutation();

alter table public.epistemic_phase4_pilot_entries enable row level security;
alter table public.epistemic_reviewer_invitations enable row level security;
alter table public.epistemic_reviewer_invitation_events enable row level security;
revoke all on table public.epistemic_phase4_pilot_entries from public, anon, authenticated;
revoke all on table public.epistemic_reviewer_invitations from public, anon, authenticated;
revoke all on table public.epistemic_reviewer_invitation_events from public, anon, authenticated;
grant select on table public.epistemic_phase4_pilot_entries to service_role;
grant select on table public.epistemic_reviewer_invitations to service_role;
grant select on table public.epistemic_reviewer_invitation_events to service_role;
revoke insert, update, delete, truncate on table public.epistemic_phase4_pilot_entries from service_role;
revoke insert, update, delete, truncate on table public.epistemic_reviewer_invitations from service_role;
revoke insert, update, delete, truncate on table public.epistemic_reviewer_invitation_events from service_role;

create or replace function public.record_epistemic_reviewer_invitation(
  p_invitation jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing public.epistemic_reviewer_invitations%rowtype;
  v_target_record jsonb;
  v_target_sha256 text;
  v_profile jsonb := p_invitation->'reviewer';
begin
  if p_invitation is null or jsonb_typeof(p_invitation) <> 'object'
    or coalesce(p_invitation->>'schemaVersion','') <> 'maha-epistemic-review-invitation/1.0'
    or coalesce(p_invitation->>'invitationId','') !~ '^epiinvite_[a-f0-9]{32}$'
    or coalesce(p_invitation->>'pilotManifestVersion','') <> 'maha-phase4-pilot/1.0'
    or coalesce(p_invitation->>'recordId','') !~ '^urn:maha:record:[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_invitation->>'domainSlug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or coalesce(p_invitation->>'targetSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_invitation->>'scope','') not in ('source-fidelity','domain-fidelity','boundary-adequacy','rights-and-locator')
    or coalesce(p_invitation->>'reviewerProfileSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_invitation->>'tokenSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_invitation->>'invitationSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_invitation->>'note','')) not between 20 and 1000
    or coalesce(p_invitation->>'expiresAt','') !~ 'Z$'
    or coalesce(p_invitation->>'createdAt','') !~ 'Z$'
    or (p_invitation->>'expiresAt')::timestamptz < (p_invitation->>'createdAt')::timestamptz + interval '1 hour'
    or (p_invitation->>'expiresAt')::timestamptz > (p_invitation->>'createdAt')::timestamptz + interval '30 days'
    or coalesce(p_invitation->>'invitedByFingerprint','') <> p_actor_fingerprint
    or coalesce(v_profile->>'reviewerId','') !~ '^expert_[a-z0-9][a-z0-9_-]{6,63}$'
    or coalesce(v_profile->>'profileVersion','') !~ '^[1-9][0-9]*$'
    or jsonb_typeof(v_profile->'qualifications') <> 'array' or jsonb_array_length(v_profile->'qualifications') < 1
    or jsonb_typeof(v_profile->'domains') <> 'array' or not (v_profile->'domains' ? (p_invitation->>'domainSlug'))
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid epistemic reviewer invitation.' using errcode = '22023'; end if;

  select * into v_existing from public.epistemic_reviewer_invitations where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('invitationId', v_existing.invitation_id, 'idempotentReplay', true); end if;

  if not exists (
    select 1 from public.epistemic_phase4_pilot_entries pilot
    where pilot.manifest_version = p_invitation->>'pilotManifestVersion'
      and pilot.candidate_record_id = p_invitation->>'recordId'
      and pilot.domain_slug = p_invitation->>'domainSlug'
  ) then raise exception 'Invitation target is outside the bounded Phase 4 pilot.' using errcode = 'P0002'; end if;

  select target.record_snapshot, target.target_sha256 into v_target_record, v_target_sha256 from (
    select record_snapshot->'candidateSnapshot' as record_snapshot, review_target_sha256 as target_sha256, created_at as target_at
      from public.epistemic_ingestion_records where candidate_record_id = p_invitation->>'recordId'
    union all
    select record_snapshot, output_review_target_sha256 as target_sha256, compiled_at as target_at
      from public.epistemic_reingestion_compilations where candidate_record_id = p_invitation->>'recordId'
  ) target order by target.target_at desc limit 1;
  if v_target_record is null then raise exception 'Frozen pilot review target not found.' using errcode = 'P0002'; end if;
  if v_target_sha256 <> p_invitation->>'targetSha256'
    or v_target_record->>'domainSlug' <> p_invitation->>'domainSlug'
    or not (coalesce(v_target_record#>'{publication,requiredReviewScopes}','[]'::jsonb) ? (p_invitation->>'scope'))
  then raise exception 'Invitation must bind a required scope on the latest frozen target.' using errcode = 'P0001'; end if;

  insert into public.epistemic_reviewer_invitations (
    invitation_id, schema_version, pilot_manifest_version, candidate_record_id, domain_slug,
    target_sha256, review_scope, reviewer_id, reviewer_profile_version,
    reviewer_profile_sha256, reviewer_profile_snapshot, token_sha256, note, expires_at,
    invitation_sha256, invitation_snapshot, invited_by_fingerprint,
    idempotency_hash, created_at
  ) values (
    p_invitation->>'invitationId', p_invitation->>'schemaVersion', p_invitation->>'pilotManifestVersion', p_invitation->>'recordId', p_invitation->>'domainSlug',
    p_invitation->>'targetSha256', p_invitation->>'scope', v_profile->>'reviewerId', (v_profile->>'profileVersion')::integer,
    p_invitation->>'reviewerProfileSha256', v_profile, p_invitation->>'tokenSha256', p_invitation->>'note', (p_invitation->>'expiresAt')::timestamptz,
    p_invitation->>'invitationSha256', p_invitation, p_actor_fingerprint,
    p_idempotency_hash, (p_invitation->>'createdAt')::timestamptz
  );
  return jsonb_build_object('invitationId', p_invitation->>'invitationId', 'idempotentReplay', false);
end; $$;

create or replace function public.consume_epistemic_reviewer_invitation(
  p_token_sha256 text,
  p_review jsonb,
  p_profile_sha256 text,
  p_idempotency_hash text,
  p_event jsonb
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invitation public.epistemic_reviewer_invitations%rowtype;
  v_terminal public.epistemic_reviewer_invitation_events%rowtype;
  v_review_result jsonb;
  v_current_target_sha256 text;
  v_existing_decision text;
begin
  if p_token_sha256 !~ '^sha256:[a-f0-9]{64}$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_review is null or jsonb_typeof(p_review) <> 'object'
    or p_event is null or jsonb_typeof(p_event) <> 'object'
    or coalesce(p_event->>'schemaVersion','') <> 'maha-epistemic-review-invitation-event/1.0'
    or coalesce(p_event->>'eventId','') !~ '^epiinviteevent_[a-f0-9]{32}$'
    or coalesce(p_event->>'action','') <> 'consume'
    or coalesce(p_event->>'reviewId','') <> coalesce(p_review->>'reviewId','')
    or coalesce(p_event->>'actorFingerprint','') <> p_token_sha256
    or coalesce(p_event->>'eventSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_event->>'reason','')) not between 20 and 1000
    or coalesce(p_event->>'occurredAt','') !~ 'Z$'
  then raise exception 'Invalid invitation consumption.' using errcode = '22023'; end if;

  select * into v_invitation from public.epistemic_reviewer_invitations
    where token_sha256 = p_token_sha256 for update;
  if not found then raise exception 'Reviewer invitation not found.' using errcode = 'P0002'; end if;

  select * into v_terminal from public.epistemic_reviewer_invitation_events
    where invitation_id = v_invitation.invitation_id;
  if found then
    if v_terminal.action = 'consume' and v_terminal.idempotency_hash = p_idempotency_hash then
      select decision into v_existing_decision from public.epistemic_expert_review_decisions where review_id = v_terminal.review_id;
      return jsonb_build_object('reviewId', v_terminal.review_id, 'decision', v_existing_decision, 'invitationId', v_invitation.invitation_id, 'idempotentReplay', true);
    end if;
    raise exception 'Reviewer invitation has already been consumed or revoked.' using errcode = 'P0001';
  end if;

  if v_invitation.expires_at <= now() then raise exception 'Reviewer invitation has expired.' using errcode = 'P0003'; end if;
  if coalesce(p_review->>'recordId','') <> v_invitation.candidate_record_id
    or coalesce(p_review->>'domainSlug','') <> v_invitation.domain_slug
    or coalesce(p_review->>'targetSha256','') <> v_invitation.target_sha256
    or coalesce(p_review->>'scope','') <> v_invitation.review_scope
    or coalesce(p_review#>>'{reviewer,reviewerId}','') <> v_invitation.reviewer_id
    or coalesce(p_review#>>'{reviewer,profileVersion}','') <> v_invitation.reviewer_profile_version::text
    or p_review->'reviewer' <> v_invitation.reviewer_profile_snapshot
    or p_profile_sha256 <> v_invitation.reviewer_profile_sha256
    or coalesce(p_event->>'invitationId','') <> v_invitation.invitation_id
  then raise exception 'Review submission differs from the exact invitation grant.' using errcode = 'P0001'; end if;

  select target.target_sha256 into v_current_target_sha256 from (
    select review_target_sha256 as target_sha256, created_at as target_at
      from public.epistemic_ingestion_records where candidate_record_id = v_invitation.candidate_record_id
    union all
    select output_review_target_sha256 as target_sha256, compiled_at as target_at
      from public.epistemic_reingestion_compilations where candidate_record_id = v_invitation.candidate_record_id
  ) target order by target.target_at desc limit 1;
  if v_current_target_sha256 is null or v_current_target_sha256 <> v_invitation.target_sha256
  then raise exception 'Reviewer invitation no longer binds the latest frozen target.' using errcode = 'P0001'; end if;

  select public.record_epistemic_expert_review(
    p_review, p_profile_sha256, p_idempotency_hash, p_token_sha256
  ) into v_review_result;

  insert into public.epistemic_reviewer_invitation_events (
    event_id, schema_version, invitation_id, action, review_id, reason,
    event_sha256, event_snapshot, actor_fingerprint, idempotency_hash,
    occurred_at, created_at
  ) values (
    p_event->>'eventId', p_event->>'schemaVersion', v_invitation.invitation_id, 'consume', p_review->>'reviewId', p_event->>'reason',
    p_event->>'eventSha256', p_event, p_token_sha256, p_idempotency_hash,
    (p_event->>'occurredAt')::timestamptz, (p_event->>'occurredAt')::timestamptz
  );
  return jsonb_build_object('reviewId', p_review->>'reviewId', 'decision', p_review->>'decision', 'invitationId', v_invitation.invitation_id, 'idempotentReplay', false);
end; $$;

create or replace function public.revoke_epistemic_reviewer_invitation(
  p_invitation_id text,
  p_event jsonb,
  p_idempotency_hash text,
  p_actor_fingerprint text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invitation public.epistemic_reviewer_invitations%rowtype;
  v_terminal public.epistemic_reviewer_invitation_events%rowtype;
begin
  if p_invitation_id !~ '^epiinvite_[a-f0-9]{32}$'
    or p_event is null or jsonb_typeof(p_event) <> 'object'
    or coalesce(p_event->>'schemaVersion','') <> 'maha-epistemic-review-invitation-event/1.0'
    or coalesce(p_event->>'invitationId','') <> p_invitation_id
    or coalesce(p_event->>'action','') <> 'revoke'
    or coalesce(p_event->'reviewId', '"missing"'::jsonb) <> 'null'::jsonb
    or coalesce(p_event->>'actorFingerprint','') <> p_actor_fingerprint
    or coalesce(p_event->>'eventSha256','') !~ '^sha256:[a-f0-9]{64}$'
    or char_length(coalesce(p_event->>'reason','')) not between 20 and 1000
    or coalesce(p_event->>'occurredAt','') !~ 'Z$'
    or p_idempotency_hash !~ '^sha256:[a-f0-9]{64}$'
    or p_actor_fingerprint !~ '^sha256:[a-f0-9]{64}$'
  then raise exception 'Invalid invitation revocation.' using errcode = '22023'; end if;

  select * into v_terminal from public.epistemic_reviewer_invitation_events
    where idempotency_hash = p_idempotency_hash;
  if found then return jsonb_build_object('eventId', v_terminal.event_id, 'invitationId', v_terminal.invitation_id, 'idempotentReplay', true); end if;

  select * into v_invitation from public.epistemic_reviewer_invitations
    where invitation_id = p_invitation_id for update;
  if not found then raise exception 'Reviewer invitation not found.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.epistemic_reviewer_invitation_events where invitation_id = p_invitation_id)
  then raise exception 'Reviewer invitation has already been consumed or revoked.' using errcode = 'P0001'; end if;

  insert into public.epistemic_reviewer_invitation_events (
    event_id, schema_version, invitation_id, action, review_id, reason,
    event_sha256, event_snapshot, actor_fingerprint, idempotency_hash,
    occurred_at, created_at
  ) values (
    p_event->>'eventId', p_event->>'schemaVersion', p_invitation_id, 'revoke', null, p_event->>'reason',
    p_event->>'eventSha256', p_event, p_actor_fingerprint, p_idempotency_hash,
    (p_event->>'occurredAt')::timestamptz, (p_event->>'occurredAt')::timestamptz
  );
  return jsonb_build_object('eventId', p_event->>'eventId', 'invitationId', p_invitation_id, 'idempotentReplay', false);
end; $$;

revoke all on function public.record_epistemic_reviewer_invitation(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.consume_epistemic_reviewer_invitation(text,jsonb,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.revoke_epistemic_reviewer_invitation(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.record_epistemic_reviewer_invitation(jsonb,text,text) to service_role;
grant execute on function public.consume_epistemic_reviewer_invitation(text,jsonb,text,text,jsonb) to service_role;
grant execute on function public.revoke_epistemic_reviewer_invitation(text,jsonb,text,text) to service_role;

comment on table public.epistemic_phase4_pilot_entries is 'Frozen Phase 4 operating corpus. Inclusion is a backlog decision, not endorsement or publication approval.';
comment on table public.epistemic_reviewer_invitations is 'Hashed one-time reviewer grants for one exact pilot target, scope, and versioned reviewer identity.';
comment on table public.epistemic_reviewer_invitation_events is 'One append-only terminal event per reviewer invitation: consumed into a review or revoked.';

notify pgrst, 'reload schema';
