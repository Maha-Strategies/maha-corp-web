-- Admit only the dedicated source-override revision canary adapter while
-- preserving every adapter accepted by the preceding licensing migration.
-- This migration cannot create review decisions or canonical releases.
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
    'source-override-revision-canary'
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
    'source-override-revision-canary'
  ));
