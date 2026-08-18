# Maha Celestial Evidence API v1

This API packages the deterministic chart and corporate-event engines for organizations. It certifies calculation inputs, conventions, rule provenance, and reproducibility—not astrology's predictive validity.

## Production contract

- Base path: `/api/v1/celestial`
- Authentication: Maha API key. The gateway resolves the key to a tenant and consumes the normal request credit.
- Contract: `maha-celestial-api/1`. Additive response fields may appear within v1; existing fields and meanings remain compatible.
- Idempotency: a saved report's `clientRequestId` is unique within a tenant. An identical replay returns the prior encrypted report and zero new report units. Reuse with different input returns `409`.
- Limits: 256 KiB request body; 25 reports per synchronous batch.
- Data boundary: raw birth inputs and complete reports are never placed in webhooks, usage rows, or incident records.

## Tenant roles

| Role | Main capabilities |
| --- | --- |
| owner | all report, pack, webhook, usage, billing, and incident capabilities |
| admin | report administration, packs, webhooks, usage |
| developer | create/read/export reports, batches, usage |
| reviewer | read/export reports, record pack reviews |
| auditor | read/export reports, usage, incidents |
| billing | usage, billing, incidents |

The API trusts only tenant and key headers inserted by the gateway. Direct caller-supplied tenant headers do not establish identity. Provision each API key into exactly one active `celestial_organization_members` row before first use.

## Create a report

`POST /api/v1/celestial/reports`

```json
{
  "apiVersion": "maha-celestial-api/1",
  "clientRequestId": "customer_case_0001",
  "reportType": "individual-birth",
  "interpretationPack": { "packId": "facts-only", "version": "1.0.0" },
  "dataPolicy": {
    "saveReport": false,
    "retentionDays": 0,
    "consent": {
      "policyVersion": "celestial-consent/1",
      "basis": "explicit-subject-consent",
      "capturedAtUtc": "2026-08-17T10:00:00Z",
      "consentReferenceSha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  },
  "input": {
    "date": "1992-11-30",
    "time": "20:09",
    "timeZone": "America/Chicago",
    "latitudeDegrees": 48.601,
    "longitudeDegrees": -93.411,
    "placeLabel": "International Falls, Minnesota"
  }
}
```

Individual reports require explicit subject consent. Corporate reports require an authorized organizational record or public-record basis. The API stores only the consent-record digest, not the underlying consent document.

`facts-only@1.0.0`, `jyotisha-source-bound@1.0.0`, and `comparative-natal@1.0.0` are frozen manifests. Comparative output keeps traditions separate rather than silently synthesizing them. Query `GET /api/v1/celestial/packs` for immutable manifest digests. Facts-only is universally available; an owner or admin installs an interpretive version with `POST /api/v1/celestial/packs` before developers can compile with it.

## Retention, encryption, and deletion

With `saveReport=false`, no report payload reaches storage and `retentionDays` must be zero. Saved reports allow 1–3,650 days and are encrypted with AES-256-GCM using tenant/report associated data. A credential marked zero-data-retention cannot request storage.

- `GET /api/v1/celestial/reports/{reportId}` reads an unexpired saved report.
- `DELETE /api/v1/celestial/reports/{reportId}` immediately redacts ciphertext and writes a non-sensitive deletion event.
- `GET /api/v1/celestial/reports/{reportId}/export?format=json|pdf` exports complete canonical JSON or a human-readable evidence PDF.

Schedule `POST /api/cron/celestial-retention` with `Authorization: Bearer $CRON_SECRET`; it calls the bounded `purge_expired_celestial_reports` operation. Database delete privileges are revoked; deletion means cryptographic payload redaction plus a tombstone.

## Batch, webhook, usage, and billing

`POST /api/v1/celestial/batches` accepts `{ "clientRequestId": "...", "requests": [...] }`. Each item is isolated and returns completed or failed status; the job and non-sensitive result manifest are durable. This first v1 implementation processes up to 25 reports in one request.

Register an HTTPS endpoint at `POST /api/v1/celestial/webhooks` with `eventTypes`. The signing secret is disclosed once. Verify `X-Maha-Webhook-Signature` as HMAC-SHA256 over `<timestamp>.<raw-body>` and reject stale `X-Maha-Webhook-Timestamp` values. Delivery re-resolves DNS, rejects private destinations, uses a ten-second timeout, and retries with bounded exponential backoff. Schedule `POST /api/cron/celestial-webhooks` using `Authorization: Bearer $CRON_SECRET`.

`GET /api/v1/celestial/usage?start=...&end=...` returns report counts, bytes, and completed-report units by operation. Pack units are 1 for facts-only, 3 for source-bound Jyotiṣa, and 5 for comparative natal. The executed order form—not code—controls currency pricing and invoice terms.

## Deployment checklist

1. Apply `20260817000400_celestial_enterprise_product.sql` after the practitioner and corporate-report migrations.
2. Configure Supabase service-role credentials, API-key Redis, `CELESTIAL_REPORT_ENCRYPTION_KEY`, and `CRON_SECRET`.
3. Provision an organization and active member/API-key mapping. Publish the frozen pack manifests with the exact code digests.
4. Schedule report-retention purge and webhook delivery; alert on failed deliveries and migration drift.
5. Complete key rotation, backup restore, incident response, and tenant-isolation exercises before offering an SLA.
6. Execute an order form defining support hours, service credits, data-processing terms, and pricing.

The published 99.9% availability and incident-response values in `/service` are objectives only until an executed Enterprise order activates remedies. Reproducibility applies only when all recorded calculation, pack, registry, compiler, ephemeris, and time-zone versions are held constant.
