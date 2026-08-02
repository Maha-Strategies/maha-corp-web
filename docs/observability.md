# Operations and observability

Maha records privacy-scrubbed errors and sampled performance spans in Sentry and can send signed operational alerts to one HTTPS webhook receiver. None of these integrations is active until its environment variables are configured.

## Sentry configuration

Create a Sentry Next.js project, then configure these variables in Vercel Preview and Production:

```text
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_DSN=https://...
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

`SENTRY_AUTH_TOKEN` is needed during builds for source-map upload and must remain server-only. Start with a 10% trace sample rate and adjust it after measuring event volume. Error payloads drop request bodies, headers, cookies, user identity, arbitrary extras, breadcrumb messages, query strings, and exception messages before transmission.

Useful Sentry span queries:

- Redis latency and throughput: `span.op:db.redis`, grouped by `db.operation.name`.
- Modal MCP latency and throughput: `maha.dependency:modal-mcp-upstream`, grouped by `mcp.method_class` or `server.address`.
- Upstream availability: `span.op:http.client maha.dependency:modal-mcp-upstream`, grouped by `http.response.status_code`.

Span attributes deliberately exclude tenant IDs, API keys, Redis keys, JSON-RPC parameters, response bodies, and URL query strings.

## Signed operations alerts

Configure a generic HTTPS webhook receiver and a random secret of at least 32 bytes:

```text
MAHA_OPS_WEBHOOK_URL=https://alerts.example.com/maha
MAHA_OPS_WEBHOOK_SECRET=...
MAHA_LOW_CREDIT_ALERT_THRESHOLD=1000
```

The receiver must preserve the exact raw request body and verify:

```text
X-Maha-Alert-Signature: sha256=HMAC_SHA256(raw_body, MAHA_OPS_WEBHOOK_SECRET)
```

It should reject invalid signatures with a non-2xx response. The remaining headers are `X-Maha-Alert-Event` and `X-Maha-Alert-ID`. The JSON schema identifier is `maha.ops-alert.v1`.

The application and release workflows emit these alert types:

- `tenant.low_credit` when the post-request tenant balance is below the configured threshold. It deduplicates once per tenant per UTC day.
- `mcp.upstream_connectivity_failure` for timeouts, connection/protocol failures, blocked redirects, or upstream 5xx responses. It deduplicates once per tenant/server per five-minute window. Expected upstream 4xx responses do not alert.
- `release.health_failure` and `release.health_recovered` for Production release-health state transitions.
- `release.recovery_drill_failure` and `release.recovery_drill_recovered` for immutable-deployment recovery validation.

Release failures use a deterministic event ID anchored to the most recent successful workflow run. Failed runs can therefore retry notification delivery without sending duplicate email. Recovery is emitted only when the immediately preceding completed run failed. Release payloads contain bounded workflow metadata, stage outcomes, deployment ID, commit SHA, and run URL; they never include credentials, dependency response bodies, tenant data, or request payloads.

Delivery has a five-second timeout. A failed delivery becomes eligible for retry after five minutes. Alert delivery is best-effort and never changes the customer API response.

## Readiness check

Use the private, read-only endpoint with the existing revenue operations bearer token:

```bash
curl -H 'Authorization: Bearer <REVENUE_CONTROL_TOKEN>' \
  https://<deployment>/api/admin/observability-readiness
```

It returns only configuration presence and status—never DSNs, tokens, URLs, or webhook secrets. HTTP 200 means both integrations are ready; HTTP 503 means configuration is missing or invalid.

## Revenue path readiness

Every paid path fails closed: its config function returns `null` when a variable is missing or its flag is off, and the surface stops offering checkout without saying so. A deliberate shutdown and a half-finished one are indistinguishable from outside.

```bash
curl -H 'Authorization: Bearer <RELEASE_HEALTH_TOKEN>' \
  https://<deployment>/api/admin/revenue-readiness
```

Each path reports one state:

| State | Meaning | Fault |
| --- | --- | --- |
| `ready` | Enabled and fully configured | No |
| `disabled` | Flag off and none of its own variables set — a clean shutdown | No |
| `configured_not_enabled` | Fully wired but the flag was never switched on | No |
| `incomplete` | Partially wired: someone started and stopped | **Yes** |
| `enabled_incomplete` | Flag on but variables missing — it cannot transact | **Yes** |

HTTP 200 means no path is in a fault state; 503 means at least one is, and `faults` names them. Only variable **names** appear in the response — never a value, prefix, or length.

Shared platform credentials (including `STRIPE_SECRET_KEY`, `STRIPE_API_KEY_WEBHOOK_SECRET`, and `ANTHROPIC_API_KEY`) are tracked separately from path-specific ones. A shared key may be set for other paths anyway, so it is never read as evidence that this path was being wired. Optional delivery overrides such as `RESEND_API_KEY` and `MPS_PREFLIGHT_FROM_EMAIL` do not affect whether MPS Preflight can transact and are not readiness requirements.

When a required variable is missing, the response also reports any environment variable name within a small edit distance of it. This catches the failure mode where a variable is set under a near-miss name and the path fails closed exactly as if nothing had been set.

`REVENUE_PATHS` in `lib/revenue-readiness.ts` mirrors the config gates in `books.ts`, `mps-credits.ts`, `utility-billing.ts`, and the preflight, API-credit, and tenant-billing checkout routes. Update it when a gate changes; a test asserts every path declares at least one variable of its own.

**This endpoint is deliberately not one of the four release-health checks.** Those gate the last-known-good manifest that rollback depends on, and a configuration fault must never be able to withhold the recovery path. Poll it separately.

## Release verification

1. Deploy Preview with the Preview Sentry project and a test webhook receiver.
2. Confirm the readiness endpoint returns HTTP 200.
3. Trigger one synthetic server error and verify its event is redacted in Sentry.
4. Generate Redis and MCP activity, then confirm both span families appear.
5. Use a test tenant to cross the low-credit threshold and use a deliberately unavailable MCP test upstream to verify both signed alert types.
6. Repeat with Production configuration before enabling alerts for customers.
