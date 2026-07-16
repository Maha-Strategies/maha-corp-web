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

`POST /api/agent-inquiries` is an authenticated, non-binding intake endpoint for the offers published in `/agent-offers.json`. It validates against `/agent-inquiry-schema.json` and sends a review draft through Resend. It does not accept payment, create a commission, or send work automatically.

Set these deployment environment variables before enabling it:

```text
AGENT_INQUIRY_TOKEN=<unique random bearer token>
RESEND_API_KEY=<existing Resend key>
```

Optional delivery overrides are `AGENT_INQUIRY_FROM` and `AGENT_INQUIRY_TO`. Keep the bearer token server-side and issue it only to an approved client. Without `AGENT_INQUIRY_TOKEN`, the route returns `503` and sends no email.

Approved clients send JSON using the schema at `/agent-inquiry-schema.json`:

```bash
curl --request POST https://www.mahastrategies.com/api/agent-inquiries \
  --header "Authorization: Bearer $AGENT_INQUIRY_TOKEN" \
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

A successful `202` response means only that a review draft was delivered. It is not an acceptance, purchase confirmation, or service-level commitment.
