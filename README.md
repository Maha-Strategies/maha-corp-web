# Maha Strategies

The Maha Strategies platform: one Next.js application serving the public site
and publishing surfaces, the credentialed commercial APIs, and the private
operations control planes behind them. It is deployed on Vercel at
[www.mahastrategies.com](https://www.mahastrategies.com).

Most of what follows in this file is operating instructions for a specific
subsystem — read the section you need rather than the whole document.

## Stack

| Concern | Service |
| --- | --- |
| Application and hosting | Next.js (App Router), React, TypeScript, on Vercel |
| Database | Supabase Postgres, RLS with no public access policies |
| Cache, rate limits, balances | Upstash Redis, namespaced per deployment environment |
| GPU compute | Modal — `workers/maha_workers.py` |
| Payments | Stripe — a separate endpoint and signing secret per product line |
| Email | Resend |
| Telemetry | Sentry, payload-scrubbed |

## Running it locally

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

The app serves on [http://localhost:3000](http://localhost:3000). Copy
`.env.example` to `.env.local` and fill in what the surface you are working on
needs; most features degrade to a disabled state rather than crashing when their
variables are absent.

To exercise the database locally, start Supabase (`supabase start`) and apply
`supabase/migrations` plus `supabase/seed.sql`, which provides deterministic
fixtures.

## Checks

```bash
npm run typecheck && npm run lint && npm test
```

`npm test` runs the full suite in `test/`. The same commands run in CI on every
pull request, together with a production build, a production-dependency audit,
and the migration integrity check below.

## Working on this codebase

Three rules are enforced rather than assumed, because violating them corrupts
state that cannot be reconstructed:

1. **Migrations are append-only.** Never edit, rename, or delete a migration
   that has been committed — it may already have run in Production. Add a new
   forward migration. Filenames are `<14-digit UTC timestamp>_<snake_case>.sql`
   and must sort after everything already on `main`. Verify with:

   ```bash
   node --experimental-strip-types scripts/check-migrations.ts
   ```

2. **Ledgers are append-only.** Corrections are new rows and refunds are
   reversal entries; nothing edits or deletes a recorded commercial outcome.
   Operator interventions go through the audited, idempotent actions in the MPS
   operational control plane, not through direct table writes.

3. **Secrets stay server-side.** Only `NEXT_PUBLIC_*` variables reach the
   browser. Credential secrets are disclosed exactly once at issuance and stored
   only as hashes.

Framework note: this repository tracks a Next.js version whose APIs may differ
from older documentation. See [`AGENTS.md`](./AGENTS.md).

## Operations

| Runbook | Covers |
| --- | --- |
| [`docs/agent-discovery-metering.md`](./docs/agent-discovery-metering.md) | Measuring whether agents are finding the platform, and reading the numbers honestly |
| [`docs/backup-restore.md`](./docs/backup-restore.md) | Rehearsing a database restore, and measuring RTO and RPO |
| [`docs/database-migrations.md`](./docs/database-migrations.md) | Applying schema changes to Production, drift detection, evidence |
| [`docs/observability.md`](./docs/observability.md) | Sentry configuration, signed alert verification, readiness checks |
| [`docs/release-recovery.md`](./docs/release-recovery.md) | Release health, recovery drill, rollback, rehearsal, required GitHub environments |
| [`docs/preview-e2e.md`](./docs/preview-e2e.md) | Integration gates on every Preview deployment, and making them block merges |
| [`docs/slo-capacity.md`](./docs/slo-capacity.md) | Service objectives, error budgets, the bounded capacity harness |
| [`docs/x402-conformance-corpus.md`](./docs/x402-conformance-corpus.md) | Vendor-neutral x402 v2 fixtures and the offline reference runner |
| [`docs/x402-declaration-digest-proposal.md`](./docs/x402-declaration-digest-proposal.md) | Draft catalog-attested discovery declaration digest and test vectors |
| [`docs/x402-doctor.md`](./docs/x402-doctor.md) | Live resource, crawler, Bazaar drift, and bounded-settlement diagnostics |
| [`docs/x402-observatory.md`](./docs/x402-observatory.md) | Public protocol-correctness observations, inclusion policy, and scheduled operation |
| [`docs/x402-buyer-policy.md`](./docs/x402-buyer-policy.md) | Vendor-neutral pre-signing budgets, approvals, replay controls, and settlement verification |
| [`SECURITY.md`](./SECURITY.md) | Vulnerability reporting and the platform's standing security assumptions |

## Outbound Market Discovery Matrix

The private Market Scout is a read-only discovery process. It pulls attributable web-search evidence into `/admin/market-mapping`, where every proposal remains subject to a deterministic score and human review. It cannot publish, spend, deploy, or contact a person.

With `MARKET_SCOUT_SOURCES=exa` and `EXA_API_KEY` set, the default matrix rotates five queries per UTC day across MPS claim verification, research briefs, document-data extraction, and receipt operations. Each query retrieves at most eight Exa results.

To replace the defaults, set this server-only JSON environment variable:

```text
MARKET_SCOUT_QUERY_MATRIX={"lanes":[{"id":"claims","label":"Claim verification","queries":["claim verification API pricing","citation audit tool quote"]},{"id":"documents","label":"Document extraction","queries":["PDF table extraction API pricing"]}]}
```

The matrix permits up to eight named lanes and twelve queries per lane; the Scout still selects only five cross-lane queries per daily run. The older `MARKET_SCOUT_QUERIES` JSON-string-array setting remains supported as a single custom lane for backward compatibility.

## Agent Inquiry Gateway

`POST /api/agent-inquiries` is an authenticated, non-binding intake endpoint for the offers published in `/agent-offers.json`. It validates against `/agent-inquiry-schema.json`, persists the inquiry and its first event to a private Supabase ledger, then attempts to notify the reviewer through Resend. It does not accept payment, create a commission, or send work automatically.

The inquiry gateway accepts named, database-backed client credentials. Credential issuance and revocation are private reviewer operations; there is no shared public inquiry token.

Set these deployment environment variables before enabling it:

```text
AGENT_REVIEW_TOKEN=<unique reviewer bearer token>
RESEND_API_KEY=<existing Resend key>
```

Optional delivery overrides are `AGENT_INQUIRY_FROM` and `AGENT_INQUIRY_TO`. Keep the reviewer token server-side. Client credentials are created by the private registry and are shown only once at issuance.

Approved clients send JSON using the schema at `/agent-inquiry-schema.json`:

```bash
curl --request POST https://www.mahastrategies.com/api/agent-inquiries \
  --header "Authorization: Bearer $CLIENT_CREDENTIAL" \
  --header "Content-Type: application/json" \
  --data '{
    "clientRequestId": "client-generated-unique-id",
    "offerId": "rapid-intelligence-brief",
    "requester": { "name": "Requesting principal", "email": "principal@example.com" },
    "decision": "The decision this brief will inform.",
    "question": "One clearly defined market, technology, or policy question.",
    "requesterAuthorized": true,
    "agent": { "name": "Approved client agent", "version": "1.0" }
  }'
```

A successful `202` response means only that the request was recorded for human review. The returned `notificationStatus` shows whether the optional email notification was delivered. Neither result is an acceptance, purchase confirmation, or service-level commitment.

Apply `supabase/migrations/20260716_agent_inquiry_ledger.sql`, `supabase/migrations/20260716_agent_client_credentials.sql`, `supabase/migrations/20260716_mps_audit_jobs.sql`, and `supabase/migrations/20260717_serverless_credential_rate_limits.sql` in the Supabase SQL Editor before enabling the full agent infrastructure. Together, they create the private inquiry ledger, credential registry, MPS audit ledger, database-maintained event histories, and an atomic shared credential rate limiter with RLS and no public access policies. The existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` deployment variables are required.

Selected credential-based commercial APIs also write to `commercial_api_usage_daily` through `20260727000100_privacy_preserving_commercial_api_metering.sql`. This is a daily aggregate meter for MPS audits, MPS credit reads, book-entitlement checks, and structured book-content delivery. It deliberately excludes IP addresses, user agents, token values or fingerprints, request and response bodies, referrers, emails, and visitor identifiers. The read-only aggregate board is `/admin/commercial-api-metering` and requires `REVENUE_CONTROL_TOKEN`.

Reviewer operations use a separate private endpoint:

```text
GET   /api/agent-inquiries/:inquiryId
PATCH /api/agent-inquiries/:inquiryId
```

Both require `Authorization: Bearer <AGENT_REVIEW_TOKEN>`. GET returns the full private request and its event history. PATCH accepts one action: `start_review`, `needs_clarification`, `decline`, or `approve_for_scoping`; the last is an internal disposition, not an acceptance of work.

## Client Credential Registry

Private reviewer operations are available at:

```text
GET  /api/agent-credentials
POST /api/agent-credentials
GET  /api/agent-credentials/:credentialId
PATCH /api/agent-credentials/:credentialId
```

All require `Authorization: Bearer <AGENT_REVIEW_TOKEN>`. `POST` issues a credential once; its plaintext value is returned only in that response. Supply either a new `clientName` or an existing `clientId`, plus `credentialLabel`, one or more `allowedOfferIds` and/or optional `allowedCapabilities`, optional `rateLimitPerHour` (default 12), and optional `expiresAt` (default 90 days). A capability-only credential is permitted. Capabilities default to none; the only current capability is `mps_audit`. `PATCH` accepts `{ "action": "revoke", "reason": "optional note" }`. GET endpoints never return a credential secret.

Example issuance:

```bash
curl --request POST https://www.mahastrategies.com/api/agent-credentials \
  --header "Authorization: Bearer $AGENT_REVIEW_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "clientName": "Example client agent",
    "credentialLabel": "Production research intake",
    "allowedOfferIds": ["rapid-intelligence-brief"],
    "allowedCapabilities": ["mps_audit"],
    "rateLimitPerHour": 12
  }'
```

## Capability-Gated MPS Audit API

`POST /api/mps-audits` applies the headless MPS/0.1 engine to a single passage. It requires a named client credential carrying the explicit `mps_audit` capability, uses the same credential rate limit, and stores an idempotent audit record in Supabase. The source passage is processed but deliberately not retained; the record retains the input hash, output claim excerpts, model identifier, status, and event history. This is a computational API, not a certification or a substitute for human verification.

The request schema is published at `/mps-audit-schema.json`. Use a unique `clientRequestId`; reuse of the same value with different text returns `409`. A completed response contains the audit result. A replay with the same request ID and passage returns the stored result without a second model invocation.

```bash
curl --request POST https://www.mahastrategies.com/api/mps-audits \
  --header "Authorization: Bearer $MPS_AUDIT_CREDENTIAL" \
  --header "Content-Type: application/json" \
  --data '{
    "clientRequestId": "example-audit-20260716-01",
    "text": "In 2024, the company reported a 32 percent increase in output."
  }'
```

## Public MPS audit preflight

`/audit` is the free, bounded public MPS preflight. It accepts a passage of up to 6,000 characters, returns a claim map in the browser, and lets a visitor download a source-free JSON record. It is distinct from the credentialed API and from the paid private Preflight at `/mps/preflight`.

Apply `supabase/migrations/20260717_public_mps_audit_usage.sql` and set the server-only `MPS_PUBLIC_AUDIT_RATE_LIMIT_SECRET` before deploying this version. The secret HMACs an IP-and-user-agent visitor fingerprint for a three-runs-per-day quota; neither the source text nor a source-text hash is saved in the public usage or event tables. The public event table records only submitted, completed, failed, and record-download events with counts/timestamps so that conversion can be measured without collecting the passage.

## Prepaid MPS audit access

The repository includes self-service Stripe Checkout at `/mps/audit-access`. Each purchase creates a dormant credential scoped only to `mps_audit`; Stripe's signed webhook atomically grants the configured `mps_audit_invocation` pack and activates that credential. The secret is disclosed once in the purchasing browser.

It is disabled by default. It requires the `20260717_mps_audit_credit_ledger.sql`, `20260717_self_service_mps_audit_access.sql`, and `20260717_stripe_webhook_idempotency.sql` migrations, a dedicated Stripe Price, a dedicated webhook endpoint at `/api/mps-credits/webhook`, and all of these server-only variables before `POST /api/mps-credits/checkout` can create a checkout:

```text
STRIPE_MPS_AUDIT_CREDIT_PRICE_ID
MPS_AUDIT_CREDIT_PACK_UNITS
MPS_AUDIT_CREDIT_CHECKOUT_ENABLED=true
STRIPE_MPS_CREDITS_WEBHOOK_SECRET
```

Subscribe that endpoint to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, and `refund.updated`. Successful payment adds a purchase-grant entry; a successful refund adds a proportional reversal entry rather than mutating the grant. The webhook migration records each Stripe `evt_` ID under a unique constraint and atomically commits that event record with its ledger change. Duplicate events are acknowledged without another balance change, while an out-of-order refund receives a retryable response until its checkout grant exists.

`GET /api/mps-credits` returns the authenticated client’s ledger balance. For prepaid credentials, `POST /api/mps-audits` atomically reserves one credit, returns HTTP 402 with the purchase URL when none remains, and creates an idempotent refund entry if execution fails. Existing credentials default to `internal_meter` and retain their prior meter-only behavior without credit enforcement.

Book checkout webhooks must subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`, and `charge.dispute.closed`. A successful payment mints a book entitlement exactly once. Confirmed refund objects are recorded once per Stripe refund, and the entitlement is revoked only after the cumulative reversed amount reaches the original paid amount. A dispute revokes access only when Stripe closes it as lost.

## MPS operational control plane

Apply `supabase/migrations/20260718_mps_operational_control_plane.sql` after the prepaid-credit and Stripe-webhook migrations, then configure a dedicated server-only `MPS_OPERATIONS_TOKEN`. Do not reuse `AGENT_REVIEW_TOKEN`. The control plane has no public UI and never returns stored secret hashes or plaintext credentials.

Use the exact-match lookup endpoint before any intervention. The request body keeps receipt emails and customer identifiers out of URL/access logs. Supported values are a receipt email, client ID, credential ID, 14-character credential prefix, checkout ID, Stripe Checkout Session ID, PaymentIntent ID, Refund ID, or Event ID.

```bash
curl --request POST https://www.mahastrategies.com/api/admin/mps-operations/lookup \
  --header "Authorization: Bearer $MPS_OPERATIONS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"query":"customer@example.com"}'
```

Mutations use `/api/admin/mps-operations/actions`. Every request requires a unique operator-supplied idempotency key, a reason, and an external ticket or Stripe reference. The database commits the mutation and immutable operator-action record in one transaction.

Append a credit correction; never edit or delete existing ledger rows:

```json
{
  "action": "credit_adjustment",
  "clientId": "client_...",
  "quantity": 1,
  "idempotencyKey": "support-ticket-1042-credit-restore",
  "reason": "Restore one credit after a confirmed engine failure.",
  "referenceId": "ticket-1042"
}
```

Immediately revoke an active or pending-payment credential:

```json
{
  "action": "credential_revocation",
  "credentialId": "cred_...",
  "idempotencyKey": "abuse-case-1043-revoke",
  "reason": "Credential reported as compromised.",
  "referenceId": "ticket-1043"
}
```

Replace a lost, active prepaid MPS credential while preserving its client-level balance:

```json
{
  "action": "credential_replacement",
  "credentialId": "cred_...",
  "idempotencyKey": "support-ticket-1044-replace",
  "reason": "Customer lost the only plaintext copy.",
  "referenceId": "ticket-1044"
}
```

Replacement revokes the old credential atomically and returns the new plaintext once. An idempotent replay confirms the original replacement but cannot redisclose its plaintext. Deliver new credentials through an approved secret-sharing channel; never put them in tickets, logs, source control, or chat. Supabase Studio may be used for inspection, but all balance corrections, revocations, and replacements must go through these audited actions rather than direct table edits.

## Offer-to-Cash Revenue Control Plane

Apply `supabase/migrations/20260720001900_revenue_control_plane.sql` and `supabase/migrations/20260720002000_revenue_event_reconciliation.sql`, then configure a separate, server-only `REVENUE_CONTROL_TOKEN`. Do not reuse reviewer or MPS operations tokens. The private endpoint is:

```text
POST /api/admin/revenue-control-plane
```

It records only non-PII source references, offer routing, and immutable commercial outcome events. It cannot send outreach, charge a customer, sign a contract, operate a wallet, or accept an engagement. Existing self-service offers route to their current purchase pages; Rapid Intelligence Brief and Verified Research Brief signals remain subject to human scope and price confirmation.

Route an inbound signal with a stable source reference:

```json
{
  "action": "route_inbound",
  "idempotencyKey": "inbound-brief-1042",
  "reason": "Qualified website inquiry entered the commercial review queue.",
  "referenceId": "contact-1042",
  "signal": {
    "sourceType": "website_contact",
    "sourceReference": "contact-1042",
    "offerId": "rapid-intelligence-brief",
    "hasDefinedDecision": true,
    "hasSpecificQuestion": true,
    "hasOrganization": true
  }
}
```

Later record a stateful outcome with a different idempotency key. `paid` and `refunded` require positive `amountCents` and a three-letter currency. The ledger allows only valid transitions: routing/review to checkout, checkout to paid, paid to delivered, and paid or delivered to refunded.

Verified Stripe payment and reversal webhooks now reconcile automatically into this ledger. MPS audit credits and book entitlements are marked delivered only after their existing product webhooks issue access; MPS Preflight records delivery when its report completes. Stripe remains the payment authority, and no revenue control-plane token is sent to Stripe or the browser.

## Operations and observability

The platform includes privacy-scrubbed Sentry error/performance telemetry, Redis and Modal MCP dependency spans, signed low-credit and upstream-connectivity webhooks, and a private configuration-readiness endpoint. See [the operations runbook](./docs/observability.md) for environment variables, signature verification, dashboards, and release tests.

Production release health runs four times per hour, preserves the exact last-known-good Vercel deployment, and supports a reviewer-gated rollback with post-recovery readiness and full canary verification. See [the release recovery runbook](./docs/release-recovery.md).

Internal availability and latency objectives are enforced by a bounded Preview capacity harness covering public surfaces, readiness dependencies, Upstash key lookup, and an explicitly confirmed controlled-upstream MCP profile. See [service objectives and capacity acceptance](./docs/slo-capacity.md).

## Inbound Revenue Gatekeeper

Apply `supabase/migrations/20260720002100_inbound_revenue_gatekeeper.sql`. Public human and agent submissions use `POST /api/inbound-submissions`, with the schema at `/inbound-submission-schema.json` and the machine-readable agent card at `/.well-known/agent.json`. The endpoint uses a database-backed hourly rate limit, a honeypot, strict size/schema validation, and deterministic qualification. It routes every accepted submission to the private Revenue Control Plane but never creates a commitment, payment, contract, or automatic outreach.

The scheduled `GET /api/cron/inbound-digest` endpoint sends one daily digest of unsent qualified submissions. Configure `INBOUND_DIGEST_TO` and Vercel's `CRON_SECRET`; `INBOUND_DIGEST_TOKEN` is available only for a separately authorized manual trigger. `vercel.json` schedules the Vercel Cron invocation for 13:00 UTC. The digest contains personal contact details, so keep its recipient address private.

## Inbound Operations Queue

Apply `supabase/migrations/20260720003200_inbound_operations_queue.sql`, configure a separate server-only `INBOUND_OPERATIONS_TOKEN`, then open `/admin/inbound`. The private queue displays inbound qualification, contact context, linked revenue status, and an append-only review history. Its actions are limited to review, clarification, scope approval, checkout referral, decline, and close-lost. It cannot send any message, accept an engagement, or mark a payment as received.
