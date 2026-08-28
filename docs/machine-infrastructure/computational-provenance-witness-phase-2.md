# Computational Provenance Witness — Phase 2 Registry

Status: private, authenticated machine infrastructure. This layer is not in
public discovery, the sitemap, `llms.txt`, or the public OpenAPI document.

## What Phase 2 adds

- Tenant identity inherited from an active Maha API key.
- A fail-closed `tenant-api-key` role with separate verify, submit, read, and
  purge permissions. Phase 2 grants all four to an active tenant key; later
  installation credentials can narrow this list without changing handlers.
- One metered API unit for receipt verification or submission; reads and
  payload deletion are authenticated but not metered.
- A 256 KiB request ceiling and 2,048-artifact ceiling.
- Mandatory `Idempotency-Key` binding to the exact receipt digest and retention
  period. Reuse with a changed request fails; the same receipt under a new key
  is reported as a replay rather than duplicated.
- Explicit, request-scoped persistence consent and a 1-3,650 day payload
  retention period.
- Immutable receipt identity separated from a purgeable receipt payload.
- Tenant-requested payload deletion and a daily expiry purge.
- Tenant-scoped readback and independent server verification while the payload
  remains available.

## API contract

Submission:

`POST /api/v1/witness/receipts`

Required headers:

- `Authorization: Bearer <MAHA_API_KEY>`
- `Content-Type: application/json`
- `Idempotency-Key: <8-120 safe characters>`
- `X-Maha-Witness-Retention-Consent: persist-receipt`
- `X-Maha-Witness-Retention-Days: <1-3650>`

The body is one `maha-computational-witness/0.1` receipt. An API key configured
for generic zero-data retention can still persist this one receipt only when it
sends the explicit endpoint-specific consent header; the response discloses
that scoped override.

Read and verify stored payload:

`GET /api/v1/witness/receipts/{receiptSha256}`

Delete stored payload early:

`DELETE /api/v1/witness/receipts/{receiptSha256}`

After deletion or expiry, the endpoint returns the immutable digest metadata
with HTTP 410. The full receipt and its job identifier are no longer available.

Verify without persistence:

`POST /api/v1/witness/verify`

This endpoint authenticates and meters the call but stores no supplied content.
Offline verification in `maha-witness` remains available without a Maha account.

## Storage boundary

The immutable table stores tenant scope, receipt and component digests,
execution status, counts, times, retention commitment, and a pseudonymous actor
fingerprint. The raw job id is hashed. The complete receipt is held in a
separate payload table and is the only object deleted by retention controls.
Submission and purge events remain append-only.

Supabase service-role access is limited to four security-definer functions.
Direct table access is revoked from public, anonymous, authenticated, and
service-role clients. API authorization always supplies the tenant id; callers
cannot select a tenant with a request header.

## Non-claims

Registry acceptance does not certify metadata truth, environment completeness,
scientific validity, independent reproduction, regulatory compliance, or
fitness for use. Payload deletion cannot delete copies exported by a tenant
before expiry. Database-at-rest protection is provider-managed; Phase 2 does not
claim application-layer or customer-held-key encryption.

## Next phase

Phase 3 should add installation-scoped roles, signed workload identities,
Docker/OCI attestations, SLURM prolog/epilog reconciliation, Qiskit/Braket job
status reconciliation, webhook delivery, and linked independent reproductions.
Those links must remain append-only observations and must never promote a claim
automatically.
