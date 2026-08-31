-- Batch 11 mixed-lineage Preview rehearsal.
--
-- Applied only to an ephemeral Preview branch by the manually dispatched
-- rehearsal workflow. It admits one dedicated adapter and records what the
-- rehearsal observed; it creates no review decision and no canonical release,
-- and it cannot promote anything to Production.

alter table public.epistemic_ingestion_batches
  drop constraint if exists epistemic_ingestion_batches_adapter_id_check;
alter table public.epistemic_ingestion_batches
  add constraint epistemic_ingestion_batches_adapter_id_check
  check (adapter_id in (
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary',
    'source-override-revision-canary',
    'batch-11-mixed-lineage-rehearsal'
  ));

alter table public.epistemic_ingestion_records
  drop constraint if exists epistemic_ingestion_records_adapter_id_check;
alter table public.epistemic_ingestion_records
  add constraint epistemic_ingestion_records_adapter_id_check
  check (adapter_id in (
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary',
    'source-override-revision-canary',
    'batch-11-mixed-lineage-rehearsal'
  ));

-- The imported predecessors, held separately from the release tables so an
-- import can never be mistaken for a release this rehearsal issued.
create table if not exists public.batch_11_rehearsal_imported_lineage (
  record_id text primary key,
  prior_release_id text not null,
  prior_target_sha256 text not null,
  imported_at timestamptz not null default now(),
  constraint batch_11_rehearsal_imported_lineage_digest_check
    check (prior_target_sha256 like 'sha256:%')
);

-- Exactly the four superseding predecessors may be imported. The initial
-- record has no predecessor, and admitting one here would manufacture the very
-- lineage its gate requires to be absent.
alter table public.batch_11_rehearsal_imported_lineage
  drop constraint if exists batch_11_rehearsal_imported_lineage_allowlist_check;
alter table public.batch_11_rehearsal_imported_lineage
  add constraint batch_11_rehearsal_imported_lineage_allowlist_check
  check (record_id in (
    'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
    'urn:maha:record:critical-supply-chains-high-purity-quartz-deposits',
    'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
    'urn:maha:record:mechanistic-interpretability-representation-probing-boundary'
  ));

-- Append-only observation log. Timestamps live here and never in the
-- deterministic artifacts, so evidence stays byte-identical across runs.
create table if not exists public.batch_11_rehearsal_observations (
  id bigserial primary key,
  phase text not null,
  status text not null,
  detail text not null,
  observed_at timestamptz not null default now(),
  constraint batch_11_rehearsal_observations_phase_check
    check (phase in (
      'provision-ephemeral-branch',
      'import-prior-lineages',
      'apply-migrations',
      'ingest-revisions-and-decisions',
      'issue-releases',
      'verify-transitions',
      'destroy-ephemeral-branch'
    )),
  constraint batch_11_rehearsal_observations_status_check
    check (status in ('executed', 'refused', 'skipped'))
);

revoke update, delete on public.batch_11_rehearsal_observations from public;

comment on table public.batch_11_rehearsal_observations is
  'Append-only Preview rehearsal log. Never populated in Production.';
