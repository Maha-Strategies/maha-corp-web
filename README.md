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

Apply `supabase/migrations/20260716_agent_inquiry_ledger.sql` and then `supabase/migrations/20260716_agent_client_credentials.sql` in the Supabase SQL Editor before enabling client credentials. Together, they create the private inquiry ledger, database-maintained event histories, client credential registry, and RLS with no public access policies. The existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` deployment variables are required.

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

All require `Authorization: Bearer <AGENT_REVIEW_TOKEN>`. `POST` issues a credential once; its plaintext value is returned only in that response. Supply either a new `clientName` or an existing `clientId`, plus `credentialLabel`, `allowedOfferIds`, optional `rateLimitPerHour` (default 12), and optional `expiresAt` (default 90 days). `PATCH` accepts `{ "action": "revoke", "reason": "optional note" }`. GET endpoints never return a credential secret.

Example issuance:

```bash
curl --request POST https://www.mahastrategies.com/api/agent-credentials \
  --header "Authorization: Bearer $AGENT_REVIEW_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "clientName": "Example client agent",
    "credentialLabel": "Production research intake",
    "allowedOfferIds": ["rapid-intelligence-brief"],
    "rateLimitPerHour": 12
  }'
```
