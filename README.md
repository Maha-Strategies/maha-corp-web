This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
