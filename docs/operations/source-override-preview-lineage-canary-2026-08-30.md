# Source-override Preview lineage canary · 2026-08-30

Status: completed in an ephemeral schema-only Supabase Preview branch. This is operational evidence, not a Production release record.

## Authorized Production read

- Read method: exact-ID, service-role REST selection against `epistemic_canonical_releases` and matching `epistemic_release_withdrawals` only.
- Canonical release rows exported: 2.
- Withdrawal rows exported: 0.
- Customer, natal, enquiry, payment, credential and unrelated rows exported: 0.
- Production writes: 0.
- Release export SHA-256: `42fd4970fc1b362f51913381008e71f5a3982f09c8978c2a93772f1d23641073`.
- Empty withdrawal export SHA-256: `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

The two immutable lineages were:

1. `epirelease_cf7d30fd107544bb8cf80ef1d184e5b6` · `urn:maha:record:advanced-materials-graphene-hbn-heterostructures`
2. `epirelease_ddb8847cfa1748a19c374b2b71bc913e` · `urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing`

## Preview import and lifecycle

- Imported canonical release rows: 2.
- Imported withdrawal rows: 0.
- Unrelated imported rows: 0.
- Import was transactional and required an empty target release ledger.
- Exact revised targets reviewed: 5.
- Scoped internal-editorial decisions: 20.
- Active exact-revision Preview releases: 5.
- Superseding releases: 2.
- Initial releases: 3.
- External expert review claimed: no.
- Independent reproduction claimed: no.

The lifecycle discovered and closed three fail-closed integration gaps: the dedicated adapter was absent from immutable-ledger constraints; one reviewer profile version varied by domain; and generic ingestion re-labelled inspected source overrides as uninspected. Each correction is additive or append-only. Earlier blocked batches and decisions were not deleted or rewritten.

## Final projection evidence

- Exact deployment commit: `995f296e40cd4324b44ce4c0b52682a3b19c76f6`.
- Protected workflow: [run 33309627853](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/33309627853).
- Routes returning HTTP 200: 5/5.
- Provenance routes returning HTTP 200: 5/5.
- Sitemap inclusion: 5/5.
- `llms.txt` inclusion: 5/5.
- Public release-registry inclusion: 5/5.
- Sanitized evidence SHA-256: `12beb5c96c8f9d30f61fe808285edbdb7bb3b5f134fc45b5a83e864d6d3e16c7`.
- Embedded canonical evidence digest: `sha256:061f72922a7d483503264abdb981cd5969fab57cd4ddb95a404341d7eb695e6c`.
- Secrets in evidence: none.
- Production mutation performed: false.

The ephemeral database branch and temporary Preview credentials were destroyed after evidence preservation. Reproducing this canary requires a new schema-only Preview branch, a new bounded export authorization and fresh Preview-only credentials.
