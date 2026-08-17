-- Durable exploratory event corpus with an explicit denominator.
--
-- A corpus definition is editable only while it is a draft. Locking fixes the
-- sampling window, clock cadence, event definition, negative-evidence
-- procedure, activity type, and pseudonymous natal-profile digest. Every
-- observation is then append-only. Precise birth inputs and evidence payloads
-- never enter these tables; only their SHA-256 digests do.

create table if not exists public.celestial_event_corpora (
  corpus_id text primary key check (corpus_id ~ '^corp_[a-z0-9]{12,48}$'),
  participant_pseudonym text not null check (participant_pseudonym ~ '^pseudo_[a-z0-9]{8,64}$'),
  status text not null default 'draft' check (status in ('draft', 'locked')),
  corpus_version text not null check (char_length(corpus_version) between 3 and 80),
  natal_profile_sha256 text not null check (natal_profile_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  definition jsonb not null,
  definition_sha256 text not null check (definition_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint corpus_lock_fields_match_status check (
    (status = 'draft' and locked_at is null) or (status = 'locked' and locked_at is not null)
  ),
  constraint corpus_denormalized_fields_match_definition check (
    participant_pseudonym = definition->>'participantPseudonym'
    and corpus_version = definition->>'corpusVersion'
    and natal_profile_sha256 = definition->>'natalProfileSha256'
    and corpus_id = definition->>'corpusId'
    and definition->>'studyRole' = 'exploratory'
  )
);

create table if not exists public.celestial_event_observations (
  observation_sha256 text primary key check (observation_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  observation_id text not null unique check (observation_id ~ '^obs_[a-z0-9]{12,64}$'),
  corpus_id text not null references public.celestial_event_corpora (corpus_id),
  definition_sha256 text not null check (definition_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  observation_kind text not null check (observation_kind in ('milestone', 'non-event')),
  interval_start timestamptz not null,
  interval_end timestamptz not null check (interval_end > interval_start),
  selection_method text not null check (selection_method in ('observed-event', 'systematic-clock')),
  source_kind text not null check (source_kind ~ '^[a-z][a-z0-9_-]{2,79}$'),
  data_source_id text not null check (char_length(data_source_id) between 3 and 120),
  evidence_sha256 text not null check (evidence_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  metric jsonb,
  celestial_state jsonb not null,
  state_vector_sha256 text not null check (state_vector_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint observation_selection_matches_kind check (
    (observation_kind = 'milestone' and selection_method = 'observed-event')
    or (observation_kind = 'non-event' and selection_method = 'systematic-clock')
  ),
  unique (corpus_id, interval_start, interval_end, observation_kind)
);

create index if not exists celestial_event_observations_corpus_time_idx
  on public.celestial_event_observations (corpus_id, interval_start);
create index if not exists celestial_event_observations_kind_idx
  on public.celestial_event_observations (corpus_id, observation_kind, interval_start);

create or replace function public.enforce_celestial_event_corpus_lock()
returns trigger language plpgsql as $$
begin
  if old.status = 'locked' then
    if new is distinct from old then
      raise exception 'celestial event corpus % is locked and cannot be modified', old.corpus_id
        using errcode = 'check_violation';
    end if;
  elsif new.status = 'locked' then
    if new.definition is distinct from old.definition
      or new.definition_sha256 is distinct from old.definition_sha256
      or new.participant_pseudonym is distinct from old.participant_pseudonym
      or new.natal_profile_sha256 is distinct from old.natal_profile_sha256
      or new.corpus_version is distinct from old.corpus_version
    then
      raise exception 'celestial event corpus % changed while its definition was being locked', old.corpus_id
        using errcode = 'check_violation';
    end if;
    if new.locked_at > clock_timestamp() + interval '5 seconds' then
      raise exception 'celestial event corpus % has a future lock timestamp', old.corpus_id
        using errcode = 'check_violation';
    end if;
  elsif new.status <> 'draft' then
    raise exception 'celestial event corpus % has an invalid lifecycle transition', old.corpus_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists celestial_event_corpus_lock on public.celestial_event_corpora;
create trigger celestial_event_corpus_lock before update on public.celestial_event_corpora
  for each row execute function public.enforce_celestial_event_corpus_lock();

create or replace function public.enforce_celestial_event_observation_plan()
returns trigger language plpgsql as $$
declare
  locked_corpus public.celestial_event_corpora%rowtype;
  plan jsonb;
  cadence interval;
  expected_duration interval;
begin
  select * into locked_corpus from public.celestial_event_corpora
    where corpus_id = new.corpus_id for update;
  if locked_corpus.corpus_id is null then
    raise exception 'unknown celestial event corpus %', new.corpus_id using errcode = 'foreign_key_violation';
  end if;
  if locked_corpus.status <> 'locked' then
    raise exception 'celestial event corpus % must be locked before observations are appended', new.corpus_id
      using errcode = 'check_violation';
  end if;
  if new.definition_sha256 is distinct from locked_corpus.definition_sha256 then
    raise exception 'observation does not carry the locked corpus definition digest' using errcode = 'check_violation';
  end if;
  plan := locked_corpus.definition->'samplingPlan';
  if new.interval_start < (plan->>'windowStartUtc')::timestamptz
    or new.interval_end > (plan->>'windowEndUtc')::timestamptz
  then
    raise exception 'observation falls outside the locked sampling window' using errcode = 'check_violation';
  end if;
  if new.observation_kind = 'non-event' then
    cadence := make_interval(mins => (plan->>'cadenceMinutes')::integer);
    expected_duration := make_interval(mins => (plan->>'intervalMinutes')::integer);
    if new.interval_end - new.interval_start <> expected_duration then
      raise exception 'non-event interval duration does not match the locked sampling plan' using errcode = 'check_violation';
    end if;
    if mod(extract(epoch from (new.interval_start - (plan->>'anchorUtc')::timestamptz))::bigint, extract(epoch from cadence)::bigint) <> 0 then
      raise exception 'non-event interval is not aligned to the locked systematic clock' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists celestial_event_observation_plan on public.celestial_event_observations;
create trigger celestial_event_observation_plan before insert on public.celestial_event_observations
  for each row execute function public.enforce_celestial_event_observation_plan();

alter table public.celestial_event_corpora enable row level security;
alter table public.celestial_event_observations enable row level security;

revoke all on table public.celestial_event_corpora, public.celestial_event_observations from public, anon, authenticated;
grant select, insert, update on table public.celestial_event_corpora to service_role;
grant select, insert on table public.celestial_event_observations to service_role;

revoke delete, truncate on table public.celestial_event_corpora from service_role;
revoke update, delete, truncate on table public.celestial_event_observations from service_role;
revoke all on function public.enforce_celestial_event_corpus_lock() from public, anon, authenticated;
revoke all on function public.enforce_celestial_event_observation_plan() from public, anon, authenticated;
