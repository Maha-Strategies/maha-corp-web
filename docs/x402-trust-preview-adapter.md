# x402 Trust preview adapter

Maha consumes the public `GET /v1/x402-trust-preview` showcase as an untrusted, advisory policy input. The adapter never calls the paid endpoint, signs a payment, or authorizes spending.

## Contract boundary

The reviewed provider schema is pinned at `content/integrations/x402-trust-preview.schema.json`. Its canonical SHA-256 digest is compiled into the adapter. A response is interpreted only after it passes:

1. JSON and response-size checks;
2. the pinned JSON Schema, including the top-level and nested schema identities;
3. Maha semantic checks for timestamps, numeric ranges, counter relationships, unique sample roles, and exact score-range consistency; and
4. the configured freshness, confidence, and lower-score-bound policy floors.

Contract failure denies the advisory decision. Unknown or thin evidence is not treated as permission.

## Decision mapping

- `proceed` becomes advisory `proceed` only when every evidence floor passes.
- `caution` and `parameterize` require human review when every evidence floor passes.
- `avoid`, `unverified`, `not-payable`, stale evidence, low confidence, and a low score-range floor deny.

Every result says `advisoryOnly: true` and `paymentAuthorized: false`. A separate Maha buyer policy and approval workflow must authorize any payment.

The three frozen action fixtures under `content/integrations/x402-trust/` pin the complete boundary:

- advisory `proceed` continues to the independent buyer policy;
- `require_review` opens a human approval step; and
- `deny` stops the workflow.

Their byte-level SHA-256 digests are frozen in `manifest.json`. They are synthetic protocol fixtures, not observations or endorsements of real merchants.

The public replay page at `/x402-trust/replay` exposes one metadata-only JSON download for each action. Downloads are generated from the same replay DTO through allowlisted GET routes at `/api/x402-trust/replay/{proceed|review|deny}`. Each file includes a digest over its canonical evidence payload and explicitly records that payment was not authorized. There is no arbitrary fixture identifier, live provider fetch, raw report, report prose, credential, or payment material in the download.

## Minimal telemetry

The replay has a separate, cookie-free aggregate ledger with exactly four events: `demo_started`, `scenario_completed`, `evidence_downloaded`, and `integration_requested`. A scenario is complete only when its integrity-evidence panel is opened. The latter two events require explicit clicks. Scenario events may carry only the closed identifier `proceed`, `review`, or `deny`; the other events carry no scenario identifier.

The browser sends a one-use random event identifier solely for idempotency. The service stores only its SHA-256 digest, the closed event type, the optional closed scenario identifier, and server receipt time. It stores no persistent visitor identifier, cookie, IP address, user agent, referrer, report content, evidence body, credential, wallet, or payment material. Browser events are unverified engagement signals, not proof that a person understood the result or that an integration occurred.

Apply `20260818000100_x402_trust_demo_telemetry.sql` before enabling the telemetry endpoint in an environment. If storage is unavailable, measurement fails silently in the browser and never interferes with the read-only replay or evidence download.

## Evidence retention

The result keeps the resource identifier, timestamps, score summary, recommendation, schema digest, and a SHA-256 digest of the exact response bytes. It does not keep the raw response, service description, explanations, credentials, or payment material. The transport-byte digest is not represented as a provider signature or a canonical provider attestation.

## Operator check

Run the free, read-only check with:

```sh
npm run inspect:x402-trust-preview -- --role=median
```

A non-zero exit means the live response did not pass the reviewed contract. Do not waive a nested schema-identity failure: without it, a sample can be parsed under an unintended report version.
