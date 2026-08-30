# Batch 11 mixed-lineage release runbook

Five records, two lineages. Four supersede an existing canonical release; one has
none and must be released as initial. The batch was frozen on the assumption that
all five supersede, and that assumption was wrong.

**Nothing in this document has been executed.** No release was performed, no
Preview database was created, no migration was applied, and no credential was
presented.

## Verified classification

| Record | Kind | Prior release | Proposed revision |
|---|---|---|---|
| `agentic-systems-mcp-tool-allowlisting` | **initial** | — none — | `sha256:655c3ae116314eb3d2f…` |
| `biomolecular-engineering-structure-prediction-filtering` | **superseding** | epirelease_9bf9b14ec8fb48f884efdc43e44ea349 | `sha256:4f41045346753387198…` |
| `critical-supply-chains-high-purity-quartz-deposits` | **superseding** | epirelease_d9b0cd28c1614fa58192be24afcd2a7a | `sha256:bf577646700efe497e3…` |
| `fusion-plasma-systems-tokamak-plasma-equilibrium` | **superseding** | epirelease_8e947374097d4695815dbf9ab653177b | `sha256:b06ae30e9f4b9907e6a…` |
| `mechanistic-interpretability-representation-probing-boundary` | **superseding** | epirelease_93c92eb7a317465b83fabf8d3e6962da | `sha256:c87bdda2c7cf974f864…` |

Manifest digest: `sha256:2765fd7430f37a5de403a0bc8b8aa009d17f1488f6a711fcf7175e56fd3d6a4a`

## Why the initial release is declared, not inferred

Deriving `initial` from a lookup that returned nothing would make three different
situations indistinguishable: a record that genuinely has no prior release, a
registry that failed to load, and a typo in a record id. All three would produce
an initial release that supersedes nothing.

So each record carries an explicitly declared kind, and reconciliation checks the
declaration against observed registry state. A superseding record whose prior
release has vanished fails with `prior-release-disappeared`; it does not become
initial. An initial record that acquires a prior release fails with
`prior-release-appeared`; it does not become superseding. Both directions are
covered by tests.

## Fail-closed codes

- `prior-release-appeared`
- `prior-release-disappeared`
- `multiple-active-prior-releases`
- `prior-revision-digest-changed`
- `proposed-revision-digest-changed`
- `decision-targets-other-revision`
- `decision-coverage-incomplete`
- `release-kind-disagrees-with-registry`
- `canonical-path-mismatch`
- `record-not-observed`
- `held-decision-cannot-release`

## Preview rehearsal — currently disabled

```bash
# Plan only. Performs no remote operation.
node --experimental-strip-types scripts/run-batch-11-preview-lineage-rehearsal.ts
```

The remote half runs only with `MAHA_B11_REHEARSAL_AUTHORIZED=1`, and even then
this change leaves it unimplemented and exiting non-zero. That is deliberate:
authorization alone should not be able to cause an unreviewed remote operation.

### Required secret names

- `MAHA_PREVIEW_SUPABASE_URL`
- `MAHA_PREVIEW_SUPABASE_SERVICE_ROLE`
- `EPISTEMIC_RELEASE_AUTHORITY_TOKEN`

Names only. No value appears in this repository, and a test asserts that.

### Migration scope

One additive migration creating only the Batch 11 rehearsal ingestion table and
its RPC. No existing table is altered. No row outside the five records is touched.
Production is never a target of the rehearsal script.

### Cleanup

Drop the rehearsal schema, then delete the Preview branch database. Because the
migration is additive and scoped to a new table, cleanup does not touch any
pre-existing object.

## What the rehearsal would prove

- All five records enter the release gate.
- The four superseding releases each bind their exact declared prior release id.
- The initial release binds no superseded target and carries `supersedesReleaseId` null.
- The publication queue admits a record only after its exact-revision release exists.
- A stale revision digest is refused at the gate.
- An older revision cannot render revised material.
- An unreleased revision stays out of the queue, the sitemap and `llms.txt`.
- Five routes, provenance chains, sitemap entries, `llms.txt` entries and registry entries converge on the same five exact revisions.

## Production

Out of scope here. A Production release requires the rehearsal to pass first and
a separate, explicit authorization of the exact run. The cohort is not released,
not public, and not Production-ready.
