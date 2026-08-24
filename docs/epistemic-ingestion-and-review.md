# Epistemic ingestion and expert review

## Purpose

This layer moves existing Maha knowledge into the shared epistemic contract
without inheriting the old page's public status. Ingestion is preservation and
evaluation, not publication.

The first adapters cover 110 core records:

| Adapter | Records |
| --- | ---: |
| Semiconductor manufacturing | 25 |
| Mathematics | 24 |
| Astronomy | 23 |
| Religion and contemplative traditions | 18 |
| Neuromorphic and biocomputing | 20 |

All 110 are initially withheld. The adapters deliberately do not invent exact
passage locators, source publication dates, replication assessments, or expert
approvals that the legacy schemas did not retain.

## Durable workflow

1. An operator calls `POST /api/admin/epistemic-ingestion` with one adapter ID
   and a unique idempotency key.
2. The server hashes the complete source dataset and each original record,
   creates deterministic candidate and review-target digests, evaluates the
   publication gate, and records one append-only batch.
3. An expert reviews one frozen target through
   `POST /api/admin/epistemic-reviews`. Their profile is retained by stable ID
   and immutable profile version.
4. Source fidelity, domain fidelity, boundary adequacy, and rights/locator
   review are separate decisions. A reservation, request for changes, stale
   digest, or abstention does not pass that scope.
5. Corrected content receives a new content hash and new review decisions. A
   later source-controlled release may request promotion and run the same gate
   again.

The private operator workspace is `/admin/epistemic-ingestion`. It keeps the
bearer token in component memory only and never writes it to browser storage.

## Phase 2 work queues

The private `/admin/epistemic-work-queue` workspace turns the fail-closed gate
output into an operational backlog without weakening the publication boundary.
It provides two projections:

- **Source completion:** one record-level queue item with every source, claim,
  structure, boundary, bridge, and integrity blocker retained by its exact gate
  reason. Operators can triage, assign, start, submit evidence, return, and close
  work through constrained transitions.
- **Expert review:** one queue item per required scope that is missing, stale,
  abstained, or has changes requested. Items deep-link into the existing review
  workspace with the record and scope preselected.

Source-completion history is append-only. Evidence rows bind a source URL,
optional exact locator and rights basis, and a bounded note to one blocker on
one frozen target. Submission moves the old target only to
`ready-for-reingestion`; it does not patch the candidate. A corrected source
record must pass through the adapter again, creating a new target hash and a new
review backlog.

## Persistence boundary

Migration `20260824050000_epistemic_ingestion_and_expert_review.sql` adds four
append-only tables:

- `epistemic_ingestion_batches`
- `epistemic_ingestion_records`
- `epistemic_expert_reviewer_profiles`
- `epistemic_expert_review_decisions`

Migration `20260824073000_epistemic_source_completion_queue.sql` adds the
append-only `epistemic_source_completion_events` ledger and the sole
security-definer function permitted to append valid state transitions. The
service role can read the ledger but cannot insert, update, delete, or truncate
it directly.

Anonymous and authenticated browser roles receive no access. The service role
has read access but cannot insert, update, delete, or truncate the ledgers
directly. Two security-definer functions validate and append ingestion batches
and expert decisions. Update and delete triggers reject mutation even if table
privileges are later broadened accidentally.

Configure a dedicated `EPISTEMIC_OPERATIONS_TOKEN` of at least 32 random bytes.
Do not reuse the practitioner, celestial registry, workflow, financial, or
general editorial credentials.

## Publication boundary

The database cannot publish a page. There is no promotion RPC, no mutable
publication status, and no code path from an ingestion credential to the
sitemap. Crawlable records still require a reviewed source change whose
`EpistemicRecord` passes `evaluatePublicationGate` during the application
release.

An expert decision is scoped evidence about one representation. It is not
product approval, scientific validation, certification, or proof that every
claim in the underlying source is true.
