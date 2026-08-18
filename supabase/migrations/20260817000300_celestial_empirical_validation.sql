-- Append-only empirical-validation artifacts. Rows contain objective outcomes,
-- fitted weights, locked forecasts, and blinded benchmark records; they do not
-- elevate any astrological rule to empirical validation.

create table if not exists public.celestial_external_datasets (
  dataset_sha256 text primary key check (dataset_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  dataset_id text not null,
  version text not null,
  title text not null,
  outcome_definition text not null,
  data_source_id text not null,
  source_manifest_sha256 text not null check (source_manifest_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  retrieved_at timestamptz not null,
  row_count integer not null check (row_count >= 100),
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.celestial_external_outcomes (
  dataset_sha256 text not null references public.celestial_external_datasets(dataset_sha256),
  event_id text not null,
  occurred_at timestamptz not null,
  available_at timestamptz not null check (available_at >= occurred_at),
  outcome smallint not null check (outcome in (0, 1)),
  source_record_id text not null,
  source_record_sha256 text not null check (source_record_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (dataset_sha256, event_id)
);

create table if not exists public.celestial_fitted_models (
  artifact_sha256 text primary key check (artifact_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  model_id text not null,
  dataset_sha256 text not null references public.celestial_external_datasets(dataset_sha256),
  frame text not null check (frame in ('tropical', 'sidereal-lahiri')),
  trained_through timestamptz not null,
  artifact jsonb not null,
  created_at timestamptz not null default now(),
  unique (model_id, artifact_sha256)
);

create table if not exists public.celestial_prospective_forecasts (
  forecast_sha256 text primary key check (forecast_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  forecast_id text not null unique,
  subject_pseudonym text not null check (subject_pseudonym ~ '^pseudo_[a-z0-9]{8,64}$'),
  issued_at timestamptz not null,
  outcome_window_start timestamptz not null check (outcome_window_start > issued_at),
  outcome_window_end timestamptz not null check (outcome_window_end > outcome_window_start),
  forecast jsonb not null,
  created_at timestamptz not null default now(),
  constraint forecast_json_digest_present check (forecast->>'forecastId' = forecast_id)
);

create table if not exists public.celestial_forecast_outcomes (
  outcome_sha256 text primary key check (outcome_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  forecast_id text not null unique references public.celestial_prospective_forecasts(forecast_id),
  outcome smallint not null check (outcome in (0, 1)),
  outcome_available_at timestamptz not null,
  retrieved_at timestamptz not null check (retrieved_at >= outcome_available_at),
  source_record_sha256 text not null check (source_record_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  score jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.celestial_skill_policies (
  policy_sha256 text primary key check (policy_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  policy_id text not null unique,
  locked_at timestamptz not null,
  policy jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.celestial_skill_assessments (
  assessment_sha256 text primary key check (assessment_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  policy_sha256 text not null references public.celestial_skill_policies(policy_sha256),
  assessment jsonb not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.astrobench_protocols (
  protocol_sha256 text primary key check (protocol_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null unique,
  protocol jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.astrobench_participants (
  participant_sha256 text primary key check (participant_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null references public.astrobench_protocols(protocol_id),
  participant_pseudonym text not null,
  participant_kind text not null,
  recruitment jsonb not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, participant_pseudonym)
);

create table if not exists public.astrobench_tasks (
  task_sha256 text primary key check (task_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null references public.astrobench_protocols(protocol_id),
  blinded_task_id text not null,
  submission_deadline timestamptz not null,
  outcome_available_at timestamptz not null check (outcome_available_at > submission_deadline),
  task jsonb not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, blinded_task_id)
);

create table if not exists public.astrobench_assignments (
  assignment_sha256 text primary key check (assignment_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null references public.astrobench_protocols(protocol_id),
  blinded_task_id text not null,
  participant_pseudonym text not null,
  assigned_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, blinded_task_id, participant_pseudonym),
  foreign key (protocol_id, blinded_task_id) references public.astrobench_tasks(protocol_id, blinded_task_id),
  foreign key (protocol_id, participant_pseudonym) references public.astrobench_participants(protocol_id, participant_pseudonym)
);

create table if not exists public.astrobench_submissions (
  submission_sha256 text primary key check (submission_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null,
  blinded_task_id text not null,
  participant_pseudonym text not null,
  submitted_at timestamptz not null,
  submission jsonb not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, blinded_task_id, participant_pseudonym),
  foreign key (protocol_id, blinded_task_id, participant_pseudonym) references public.astrobench_assignments(protocol_id, blinded_task_id, participant_pseudonym)
);

create table if not exists public.astrobench_task_outcomes (
  outcome_sha256 text primary key check (outcome_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null,
  blinded_task_id text not null,
  outcome_available_at timestamptz not null,
  outcome jsonb not null,
  created_at timestamptz not null default now(),
  unique (protocol_id, blinded_task_id),
  foreign key (protocol_id, blinded_task_id) references public.astrobench_tasks(protocol_id, blinded_task_id)
);

create table if not exists public.astrobench_analyses (
  analysis_sha256 text primary key check (analysis_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  protocol_id text not null references public.astrobench_protocols(protocol_id),
  analysis jsonb not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_celestial_forecast_outcome_chronology()
returns trigger language plpgsql as $$
declare locked_forecast public.celestial_prospective_forecasts%rowtype;
begin
  select * into locked_forecast from public.celestial_prospective_forecasts where forecast_id = new.forecast_id;
  if locked_forecast.forecast_id is null then raise exception 'unknown prospective forecast'; end if;
  if new.outcome_available_at < locked_forecast.outcome_window_end then
    raise exception 'forecast outcome cannot be available before the locked outcome window closes' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists celestial_forecast_outcome_chronology on public.celestial_forecast_outcomes;
create trigger celestial_forecast_outcome_chronology before insert on public.celestial_forecast_outcomes
  for each row execute function public.enforce_celestial_forecast_outcome_chronology();

create or replace function public.enforce_astrobench_chronology()
returns trigger language plpgsql as $$
declare locked_task public.astrobench_tasks%rowtype;
declare locked_assignment public.astrobench_assignments%rowtype;
begin
  select * into locked_task from public.astrobench_tasks where protocol_id = new.protocol_id and blinded_task_id = new.blinded_task_id;
  select * into locked_assignment from public.astrobench_assignments where protocol_id = new.protocol_id and blinded_task_id = new.blinded_task_id and participant_pseudonym = new.participant_pseudonym;
  if locked_assignment.assignment_sha256 is null then raise exception 'submission has no frozen assignment'; end if;
  if new.submitted_at < locked_assignment.assigned_at or new.submitted_at >= locked_task.submission_deadline then
    raise exception 'submission falls outside its blinded assignment window' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists astrobench_submission_chronology on public.astrobench_submissions;
create trigger astrobench_submission_chronology before insert on public.astrobench_submissions
  for each row execute function public.enforce_astrobench_chronology();

create or replace function public.enforce_astrobench_outcome_chronology()
returns trigger language plpgsql as $$
declare locked_task public.astrobench_tasks%rowtype;
begin
  select * into locked_task from public.astrobench_tasks where protocol_id = new.protocol_id and blinded_task_id = new.blinded_task_id;
  if new.outcome_available_at < locked_task.outcome_available_at then
    raise exception 'benchmark outcome cannot be recorded before its frozen availability instant' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists astrobench_outcome_chronology on public.astrobench_task_outcomes;
create trigger astrobench_outcome_chronology before insert on public.astrobench_task_outcomes
  for each row execute function public.enforce_astrobench_outcome_chronology();

alter table public.celestial_external_datasets enable row level security;
alter table public.celestial_external_outcomes enable row level security;
alter table public.celestial_fitted_models enable row level security;
alter table public.celestial_prospective_forecasts enable row level security;
alter table public.celestial_forecast_outcomes enable row level security;
alter table public.celestial_skill_policies enable row level security;
alter table public.celestial_skill_assessments enable row level security;
alter table public.astrobench_protocols enable row level security;
alter table public.astrobench_participants enable row level security;
alter table public.astrobench_tasks enable row level security;
alter table public.astrobench_assignments enable row level security;
alter table public.astrobench_submissions enable row level security;
alter table public.astrobench_task_outcomes enable row level security;
alter table public.astrobench_analyses enable row level security;

revoke all on table public.celestial_external_datasets, public.celestial_external_outcomes, public.celestial_fitted_models,
  public.celestial_prospective_forecasts, public.celestial_forecast_outcomes, public.celestial_skill_policies, public.celestial_skill_assessments, public.astrobench_protocols,
  public.astrobench_participants, public.astrobench_tasks, public.astrobench_assignments,
  public.astrobench_submissions, public.astrobench_task_outcomes, public.astrobench_analyses from public, anon, authenticated;
grant select, insert on table public.celestial_external_datasets, public.celestial_external_outcomes, public.celestial_fitted_models,
  public.celestial_prospective_forecasts, public.celestial_forecast_outcomes, public.celestial_skill_policies, public.celestial_skill_assessments, public.astrobench_protocols,
  public.astrobench_participants, public.astrobench_tasks, public.astrobench_assignments,
  public.astrobench_submissions, public.astrobench_task_outcomes, public.astrobench_analyses to service_role;
revoke update, delete, truncate on table public.celestial_external_datasets, public.celestial_external_outcomes, public.celestial_fitted_models,
  public.celestial_prospective_forecasts, public.celestial_forecast_outcomes, public.celestial_skill_policies, public.celestial_skill_assessments, public.astrobench_protocols,
  public.astrobench_participants, public.astrobench_tasks, public.astrobench_assignments,
  public.astrobench_submissions, public.astrobench_task_outcomes, public.astrobench_analyses from service_role;
revoke all on function public.enforce_celestial_forecast_outcome_chronology(), public.enforce_astrobench_chronology(), public.enforce_astrobench_outcome_chronology() from public, anon, authenticated;
