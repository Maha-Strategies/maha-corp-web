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

## Controlled re-ingestion compiler

The private `/admin/epistemic-reingestion` workspace completes the next
transition without exposing a general-purpose patch surface. Its API accepts
only blocker codes that the compiler explicitly maps to typed fields. The first
version covers every correctable blocker present in the 110-record corpus:

- `source-locator-missing:*` → the named source's exact locator
- `source-publication-date-missing:*` → the named source's publication date
- `claim-evidence-not-assessed:*` → the named claim's evidence maturity
- `source-claim-alignment-mismatch:*` → evidence-bound scope refinement,
  complete source replacement with every linked claim explicitly remapped, or
  a bounded split that retains some claims and remaps a declared subset

Each correction must reference a prior `submit-evidence` event on the same
record and target hash. The caller cannot supply the field path or old value;
the server derives both from the frozen snapshot. Preview returns the complete
before/after diff without persistence. Compile records the diff, source event
digests, output snapshot, remaining blockers and parent/child target hashes in
the append-only `epistemic_reingestion_compilations` ledger.

Every output is forced to `draft`, `requestedPublicPromotion` is forced to
`false`, `publishedAt` is removed and all prior review events are cleared. The
new hash therefore enters fresh source-completion and expert-review queues. The
compiler has no publication or promotion operation.

Source chronology is explicit. A dated source retains its actual
`publishedAt` value. An authoritative source without a stated publication date
may instead carry `sourceChronology.status` as `undated` or `living-document`,
plus the date it was inspected and an optional source version. The compiler
accepts that chronology only when it is bound to the original date blocker and
its submitted evidence event. An access date is never written into
`publishedAt`.

An alignment correction is also typed rather than arbitrary. `refine` changes
only the existing source's `establishes` and `boundary` fields while retaining
its URL. `replace` requires a complete replacement source and the exact set of
claim IDs that referenced the displaced source. Both forms must match the
submitted evidence URL, create a new target hash, clear prior reviews, and
remain noncanonical until every required expert scope is independently met.

## Phase 3 canonical release control

The private `/admin/epistemic-releases` workspace is the only application
surface that can create a database-backed canonical release. It requires the
separate `EPISTEMIC_RELEASE_AUTHORITY_TOKEN`; the operations token is rejected.
The two configured secrets must differ and must each contain at least 32 random
bytes.

For an initial or superseding release, the server:

1. resolves the latest immutable ingestion or re-ingestion target;
2. verifies that its non-publication content still matches the target digest;
3. selects the latest review decision in every required scope on that exact
   digest and requires an unqualified `approve` verdict;
4. assembles publication controls without changing the reviewed content;
5. runs `evaluatePublicationGate` again;
6. binds the canonical version, path, approvals, authority snapshot and record
   snapshot into one release digest; and
7. appends the release through the sole validated database function.

An existing active record can be replaced only by an explicit superseding
release on a different target hash. Withdrawal is a separate append-only event.
Neither operation updates or deletes the earlier release.

The public `/knowledge/epistemic-system/releases` ledger exposes active,
superseded and withdrawn history. Its `registry.json` and per-release
`provenance.json` surfaces omit credentials, operational actor fingerprints,
private reviewer profiles and authority identity fields without explicit public
attribution consent. Internal release rationales are never projected; the
authority must provide a separate 20–500 character public-safe change summary.
Only the active projection can generate a database-backed canonical page and
sitemap row.

## Phase 4 bounded corpus and reviewer invitations

Phase 4 begins with a frozen 20-record operating corpus rather than attempting
to review all 110 migrated records at once. Four records in each migrated
domain test different failure surfaces: source fidelity, technical
formalization, uncertainty and non-claim boundaries, and rights/locator
quality. The public `/knowledge/epistemic-system/pilot-corpus` page and its
`registry.json` publish the selection, rationale, initial target hashes, and
source blockers before review outcomes are known. Inclusion is not endorsement.

The private `/admin/epistemic-review-invitations` workspace issues least-
authority reviewer credentials. Each invitation binds exactly:

- one record in the frozen pilot manifest;
- the latest immutable target hash;
- one required expert-review scope;
- one immutable reviewer profile version; and
- an expiry between one hour and 30 days.

The plaintext credential is returned only on the first successful creation
response and is held only in component memory. The ledger retains its SHA-256
digest. Idempotent replay deliberately cannot recover the credential.

Reviewers use `/review/epistemic`, which accepts only the invitation credential.
It exposes the frozen record and the three published criteria for the assigned
scope; it grants no operations, source-completion, re-ingestion, or release
authority. Submission derives record ID, domain, target hash, scope, and
reviewer identity from the invitation rather than trusting browser fields.
Creating the expert decision and consuming the invitation occur in one database
transaction. Every invitation receives at most one terminal event: `consume`
or `revoke`.

For pilot records, the older operations-authenticated review endpoint rejects
new decisions at the application boundary. This keeps the Phase 4 operating
sample invitation-only while preserving the previous endpoint for records
outside the bounded pilot.

The 13 pilot records that remained in source completion after the first
operating pass have frozen operator-research packages in
`lib/epistemic-phase4-source-packages.ts`. A package may state that an imported
source does not support the complete claim; filling the typed locator and
evidence-status fields must never disguise that mismatch. Run
`npm run operate:epistemic-phase4-sources` for a read-only Production plan, then
add `-- --apply` only after reviewing it. The runner can triage, start, submit
evidence, and compile a fresh immutable draft. It cannot invite a reviewer,
submit an expert decision, promote content, or create a canonical release.

Phase 4 is operationally complete only after real, named, versioned reviewers
submit the four required scoped decisions on exact current target hashes and a
separate release authority operates every passing record. Source packages and
synthetic lifecycle tests do not satisfy that human gate.

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

Migration `20260824133000_epistemic_controlled_reingestion.sql` adds the
append-only compilation ledger and its sole validated append function. It also
allows expert reviews and later source-completion events to bind compiler-created
targets without weakening their exact-digest requirements.

Migration `20260824190000_epistemic_canonical_release_control.sql` adds the
append-only canonical-release and withdrawal ledgers. Its security-definer
functions independently re-check current target lineage, allowable remaining
gate reasons, every exact scoped approval, canonical publication controls,
supersession state and authority snapshots before appending an event.

Migration `20260824220000_epistemic_reviewer_invitations.sql` freezes the pilot
manifest and adds invitation and terminal-event ledgers. Its security-definer
functions independently verify pilot membership, latest-target lineage,
required scope, reviewer profile identity, expiry, bearer digest, and one-time
consumption. Direct table mutation remains unavailable to the service role.

Anonymous and authenticated browser roles receive no access. The service role
has read access but cannot insert, update, delete, or truncate the ledgers
directly. Two security-definer functions validate and append ingestion batches
and expert decisions. Update and delete triggers reject mutation even if table
privileges are later broadened accidentally.

Configure a dedicated `EPISTEMIC_OPERATIONS_TOKEN` of at least 32 random bytes.
Do not reuse the practitioner, celestial registry, workflow, financial, or
general editorial credentials.

Configure `EPISTEMIC_RELEASE_AUTHORITY_TOKEN` separately, also with at least 32
random bytes. The release boundary fails closed if it equals
`EPISTEMIC_OPERATIONS_TOKEN`.

## Publication boundary

The ingestion database functions cannot publish a page, and there is no mutable
publication status. Phase 3 adds narrowly validated release RPCs behind a
separate authority credential. Only an active exact-hash release can enter the
database-backed public projection; ingestion, source completion, re-ingestion,
expert review, superseded versions and withdrawn versions cannot enter it.

An expert decision is scoped evidence about one representation. It is not
product approval, scientific validation, certification, or proof that every
claim in the underlying source is true.

## Phases 5–8 noncanonical factory

Migration `20260825010000_epistemic_noncanonical_factory.sql` adds append-only
factory-run, automated-audit, and reviewer-packet ledgers. The private
`/api/admin/epistemic-factory` surface compiles current immutable draft targets
in batches of up to 500. It rejects stale hashes, promoted records, duplicate
targets, and snapshots that differ from the durable ingestion lineage.

Every packet carries the exact candidate snapshot, claim-to-source matrix,
published review criteria, and automated findings. All review scopes remain
explicitly `unreviewed`. Packets are private, marked `noindex`, excluded from
the sitemap, and cannot call the canonical-release function.

The public factory page and its registry expose only methodology and sanitized
calculation-conformance evidence. See `docs/epistemic-publishing-factory.md`
for the operator command and the Phase 5–8 boundaries.
