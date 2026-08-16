-- Pre-registered tests of celestial-timing hypotheses.
--
-- The scientific value of this table is entirely in what it refuses. A
-- registration is a promise that the analysis plan was fixed before the outcome
-- was known; if a registered row can be edited, or an inconvenient outcome
-- deleted, the promise is worth nothing and the registry is worse than having
-- none, because it lends a false credibility.
--
-- So the invariants live here rather than only in the route handler:
--
--   * a registered experiment's analysis-relevant columns cannot change;
--   * status moves forward through the lifecycle and never backward;
--   * outcomes are insert-only, with update and delete revoked from every role
--     including service_role, so a future handler cannot acquire the ability;
--   * an outcome cannot attach to an experiment that is still a draft.
--
-- Nothing in this schema records whether a moment was "auspicious". The registry
-- tests a declared rule against a declared metric; it takes no position on the
-- rule, and every astrological rule referenced here remains
-- `unvalidated-tradition` in the claim-evidence model regardless of any result.

create table if not exists public.celestial_hypothesis_experiments (
  experiment_id text primary key check (experiment_id ~ '^exp_[a-z0-9]{16,48}$'),

  -- Pseudonymous by construction. The pattern forbids the `@` that an email
  -- address would carry, so a participant identity cannot be stored here even
  -- by a caller that wants to.
  participant_pseudonym text not null check (participant_pseudonym ~ '^pseudo_[a-z0-9]{8,64}$'),

  status text not null default 'draft'
    check (status in ('draft', 'registered', 'outcome-recorded', 'analyzed')),

  -- This version accepts confirmatory registrations only. Exploratory work over
  -- historical series has a different multiplicity problem and belongs to a
  -- subsystem that does not exist yet; the constraint makes the boundary
  -- explicit rather than relying on the route to remember.
  study_role text not null default 'confirmatory' check (study_role in ('confirmatory')),

  registry_version text not null check (char_length(registry_version) between 3 and 80),

  -- The locked payload and its digest. The digest covers every
  -- analysis-relevant field; `notes` is outside it so a registration can be
  -- annotated without breaking its own seal.
  draft jsonb not null,
  -- Digest of the current draft while it is editable. Registration is an
  -- optimistic lock conditioned on this value, preventing a concurrent draft
  -- edit from being sealed under a digest computed from older contents.
  draft_sha256 text not null check (draft_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  notes text check (notes is null or char_length(notes) <= 4000),

  registration_sha256 text check (registration_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  registered_at timestamptz,

  -- Denormalised for indexing and for the eventual public projection. Kept in
  -- step with `draft` by the lock trigger below.
  tradition_id text not null check (char_length(tradition_id) between 1 and 120),
  activity_type text not null check (char_length(activity_type) between 1 and 80),
  fact_bundle_id text not null check (fact_bundle_id ~ '^cel_[a-z0-9_-]{8,80}$'),
  fact_bundle_sha256 text not null check (fact_bundle_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  analysis_plan_version text not null check (char_length(analysis_plan_version) between 3 and 80),

  created_at timestamptz not null default now(),

  -- A draft has neither digest nor timestamp; anything past draft has both.
  constraint registration_fields_match_status check (
    (status = 'draft' and registration_sha256 is null and registered_at is null)
    or (status <> 'draft' and registration_sha256 is not null and registered_at is not null)
  ),
  constraint denormalized_fields_match_draft check (
    tradition_id = draft->'hypothesis'->>'traditionId'
    and activity_type = draft->>'activityType'
    and fact_bundle_id = draft->>'factBundleId'
    and fact_bundle_sha256 = draft->>'factBundleSha256'
    and analysis_plan_version = draft->'analysisPlan'->>'planVersion'
  )
);

create index if not exists celestial_hypothesis_experiments_status_idx
  on public.celestial_hypothesis_experiments (status, registered_at desc);

-- Outcome observations. Insert-only.
--
-- The raw payload retrieved from the system of record is NOT stored. Only its
-- digest is, which is enough to show the recorded value came from that payload
-- while leaving third-party telemetry where it belongs. `value` is the
-- normalised number in the metric's declared unit and nothing else.
create table if not exists public.celestial_hypothesis_outcomes (
  outcome_sha256 text primary key check (outcome_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  experiment_id text not null references public.celestial_hypothesis_experiments (experiment_id),

  -- One observation per key. A retry that repeats the key is rejected by this
  -- constraint rather than silently double-counted into the denominator.
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),

  value double precision not null,
  observed_at timestamptz not null,
  retrieved_at timestamptz not null,
  data_source_id text not null check (char_length(data_source_id) between 1 and 120),
  raw_value_sha256 text not null check (raw_value_sha256 ~ '^sha256:[a-f0-9]{64}$'),

  -- Ties the observation to the exact registration it was measured against, so
  -- an outcome cannot be re-pointed at a different plan.
  registration_sha256 text not null check (registration_sha256 ~ '^sha256:[a-f0-9]{64}$'),

  created_at timestamptz not null default now(),

  unique (experiment_id, idempotency_key)
);

create index if not exists celestial_hypothesis_outcomes_experiment_idx
  on public.celestial_hypothesis_outcomes (experiment_id, observed_at);

-- Analysis results. Also insert-only: a re-run writes a new row with its own
-- digest, and the sequence of results stays visible. There is no state in which
-- an unwelcome analysis disappears.
create table if not exists public.celestial_hypothesis_analyses (
  analysis_sha256 text primary key check (analysis_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  experiment_id text not null references public.celestial_hypothesis_experiments (experiment_id),
  plan_version text not null check (char_length(plan_version) between 3 and 80),
  status text not null check (status in ('pending', 'inconclusive', 'complete')),
  classification text check (classification is null or classification in ('positive', 'null', 'inconclusive', 'adverse')),
  observations integer not null check (observations >= 0),
  result jsonb not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists celestial_hypothesis_analyses_experiment_idx
  on public.celestial_hypothesis_analyses (experiment_id, computed_at desc);

-- Locks a registration.
--
-- Once status leaves 'draft', the analysis-relevant columns are frozen. The
-- check is on the column values rather than on a "locked" flag, because a flag
-- can be flipped and a value comparison cannot be talked around.
create or replace function public.enforce_celestial_hypothesis_lock()
returns trigger language plpgsql as $$
declare
  allowed_next text[];
begin
  if new.tradition_id is distinct from new.draft->'hypothesis'->>'traditionId'
    or new.activity_type is distinct from new.draft->>'activityType'
    or new.fact_bundle_id is distinct from new.draft->>'factBundleId'
    or new.fact_bundle_sha256 is distinct from new.draft->>'factBundleSha256'
    or new.analysis_plan_version is distinct from new.draft->'analysisPlan'->>'planVersion'
  then
    raise exception 'celestial hypothesis % denormalized fields do not match its draft', old.experiment_id
      using errcode = 'check_violation';
  end if;

  if old.status = 'draft' and new.status = 'registered' then
    if new.draft is distinct from old.draft or new.draft_sha256 is distinct from old.draft_sha256 then
      raise exception 'celestial hypothesis % draft changed while registration was taking the lock', old.experiment_id
        using errcode = 'check_violation';
    end if;
    if new.registration_sha256 is distinct from old.draft_sha256 then
      raise exception 'celestial hypothesis % registration digest does not match the reviewed draft', old.experiment_id
        using errcode = 'check_violation';
    end if;
    if new.registered_at > clock_timestamp() + interval '5 seconds' then
      raise exception 'celestial hypothesis % has a future registration timestamp', old.experiment_id
        using errcode = 'check_violation';
    end if;
    if (new.draft->>'actionWindowStartUtc')::timestamptz <= new.registered_at then
      raise exception 'celestial hypothesis % action window must begin after registration', old.experiment_id
        using errcode = 'check_violation';
    end if;
  end if;

  if old.status <> 'draft' then
    if new.draft is distinct from old.draft
      or new.participant_pseudonym is distinct from old.participant_pseudonym
      or new.study_role is distinct from old.study_role
      or new.draft_sha256 is distinct from old.draft_sha256
      or new.tradition_id is distinct from old.tradition_id
      or new.activity_type is distinct from old.activity_type
      or new.fact_bundle_id is distinct from old.fact_bundle_id
      or new.fact_bundle_sha256 is distinct from old.fact_bundle_sha256
      or new.analysis_plan_version is distinct from old.analysis_plan_version
      or new.registration_sha256 is distinct from old.registration_sha256
      or new.registered_at is distinct from old.registered_at
    then
      raise exception 'celestial hypothesis % is registered and its locked fields cannot be modified', old.experiment_id
        using errcode = 'check_violation';
    end if;
  end if;

  -- Forward-only lifecycle. There is no transition back to 'draft' and no
  -- terminal state that discards the experiment.
  allowed_next := case old.status
    when 'draft' then array['draft', 'registered']
    when 'registered' then array['registered', 'outcome-recorded']
    when 'outcome-recorded' then array['outcome-recorded', 'analyzed']
    when 'analyzed' then array['analyzed']
    else array[]::text[]
  end;

  if not (new.status = any(allowed_next)) then
    raise exception 'celestial hypothesis % cannot move from % to %', old.experiment_id, old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists celestial_hypothesis_lock on public.celestial_hypothesis_experiments;
create trigger celestial_hypothesis_lock
  before update on public.celestial_hypothesis_experiments
  for each row execute function public.enforce_celestial_hypothesis_lock();

-- An outcome may only attach to something already registered. A foreign key
-- cannot express this, so it is a trigger rather than a constraint.
create or replace function public.enforce_celestial_outcome_after_registration()
returns trigger language plpgsql as $$
declare
  experiment_status text;
  locked_digest text;
  locked_draft jsonb;
  recorded_outcomes integer;
begin
  select status, registration_sha256, draft into experiment_status, locked_digest, locked_draft
    from public.celestial_hypothesis_experiments
    where experiment_id = new.experiment_id
    for update;

  if experiment_status is null then
    raise exception 'unknown celestial hypothesis %', new.experiment_id using errcode = 'foreign_key_violation';
  end if;

  if experiment_status = 'draft' then
    raise exception 'celestial hypothesis % is still a draft; an outcome cannot be recorded before registration', new.experiment_id
      using errcode = 'check_violation';
  end if;

  if experiment_status = 'analyzed' then
    raise exception 'celestial hypothesis % is analyzed and its fixed sample is closed', new.experiment_id
      using errcode = 'check_violation';
  end if;

  select count(*) into recorded_outcomes
    from public.celestial_hypothesis_outcomes
    where experiment_id = new.experiment_id;
  if recorded_outcomes >= (locked_draft->>'sampleSizeTarget')::integer then
    raise exception 'celestial hypothesis % has reached its fixed sample size', new.experiment_id
      using errcode = 'check_violation';
  end if;

  if new.registration_sha256 is distinct from locked_digest then
    raise exception 'outcome for % does not carry the registered digest', new.experiment_id using errcode = 'check_violation';
  end if;

  if new.observed_at < (locked_draft->>'actionWindowStartUtc')::timestamptz then
    raise exception 'outcome for % predates the declared action window', new.experiment_id using errcode = 'check_violation';
  end if;

  if new.retrieved_at < new.observed_at then
    raise exception 'outcome for % was retrieved before it was observed', new.experiment_id using errcode = 'check_violation';
  end if;

  if new.retrieved_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'outcome for % has a future retrieval timestamp', new.experiment_id using errcode = 'check_violation';
  end if;

  if new.data_source_id is distinct from locked_draft->'metric'->>'dataSourceId' then
    raise exception 'outcome for % does not match the registered data source', new.experiment_id using errcode = 'check_violation';
  end if;

  if locked_draft->'metric'->>'kind' = 'binary' and new.value not in (0, 1) then
    raise exception 'binary outcome for % must be 0 or 1', new.experiment_id using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists celestial_outcome_after_registration on public.celestial_hypothesis_outcomes;
create trigger celestial_outcome_after_registration
  before insert on public.celestial_hypothesis_outcomes
  for each row execute function public.enforce_celestial_outcome_after_registration();

alter table public.celestial_hypothesis_experiments enable row level security;
alter table public.celestial_hypothesis_outcomes enable row level security;
alter table public.celestial_hypothesis_analyses enable row level security;

-- No public, anon, or authenticated access at all in this version.
--
-- A public registry view is desirable and is deliberately NOT enabled here. The
-- projection that would back it (`publicView` in lib/celestial-hypotheses/
-- provenance.ts) exists and is tested, but exposing registrations publicly is a
-- product decision about participant re-identification — a pseudonym plus an
-- activity type plus a precise action window can be narrowing — and that
-- decision has not been taken. Until it is, reads go through the service role.
revoke all on table
  public.celestial_hypothesis_experiments,
  public.celestial_hypothesis_outcomes,
  public.celestial_hypothesis_analyses
  from public, anon, authenticated;

grant select, insert, update on table public.celestial_hypothesis_experiments to service_role;
grant select, insert on table public.celestial_hypothesis_outcomes to service_role;
grant select, insert on table public.celestial_hypothesis_analyses to service_role;

-- The append-only guarantee, made structural.
--
-- Outcomes and analyses can be written and read and nothing else. This is the
-- line that stops a future handler, or an operator with service-role
-- credentials, from quietly removing a result that did not go the desired way.
revoke update, delete, truncate on table public.celestial_hypothesis_outcomes from service_role;
revoke update, delete, truncate on table public.celestial_hypothesis_analyses from service_role;
revoke delete, truncate on table public.celestial_hypothesis_experiments from service_role;

revoke all on function public.enforce_celestial_hypothesis_lock() from public, anon, authenticated;
revoke all on function public.enforce_celestial_outcome_after_registration() from public, anon, authenticated;
