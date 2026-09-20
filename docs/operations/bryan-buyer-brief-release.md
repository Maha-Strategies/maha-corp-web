# Bryan buyer-brief release — 20 September 2026

## Built locally, not activated

Product: assisted CABEZON Buyer-Brief Pack, 20 USDC (20,000,000 base units), distinct from the 0.01 USDC example evaluation. No production purchase, deployment, email, refund, registry update or payment was made by this work.

The prepared archive is generated into `content/buyer-brief/bundle.json` (not public/) and `output/bryan-buyer-brief-2026-09-20/maha-buyer-brief-v1.tar.gz`. Its external digest is in `archive-pin.json`. Read the recipient README and RUNBOOK before sending. The archive contains public source snapshots and synthetic data only, never private correspondence or wallet keys.

Implemented endpoints:

- GET `/api/v1/cabezon/buyer-brief`: free metadata, exact archive/terms hashes; no archive bytes.
- POST same path: fixed-version, exact-input-hash, idempotent x402 order. Validates and loads the complete artifact before settlement. Reserves capacity before settlement. Returns the archive inline with the payment receipt.
- POST `/api/v1/cabezon/buyer-brief/retrieve`: no payment. Checks a paid admission against the payer, order, exact resource/amount and input hash (which includes the buyer's private recovery secret). Returns the same pinned archive. A missing/torn ledger record is a support/reconciliation case, never grounds to charge again.

Uses the existing service-role-only `x402_offer_admissions` table and RPCs, plus migration `20260920090000_buyer_brief_notifications.sql` for the private notification outbox. The recovery query tolerates EVM address case but not a different address. No raw secret is persisted server-side. The buyer adapter persists the secret locally before signing and never automatically releases the attempt lock. Keep this state file out of logs, email, version control and report exports. Recovery authenticates possession of this secret, not a fresh wallet signature. Loss of the secret requires manual support.

## Activation checklist

### Seller notifications and approved remedy

Maha approved the two-business-day access/correction remedy, otherwise a 20 USDC purchase-price refund after order verification. This does not assert Bryan's acceptance or authorize an automatic refund transfer.

- Apply `supabase/migrations/20260920090000_buyer_brief_notifications.sql` in a test database first, then production after review. Settlement of this offer creates a private outbox event transactionally. No recovery secret is stored there.
- Configure `RESEND_API_KEY`, a verified-domain `BUYER_BRIEF_FROM_EMAIL`, and `CRON_SECRET`, plus the existing Supabase service-role connection. Recipient is fixed to `mayone@mahastrategies.com`. The cron route runs every five minutes after deployment; readiness configuration alone does not prove that cron or inbox delivery works.
- Purchase notifications mean the ledger recorded settlement, not that the buyer received or accepted the archive. The archive is delivered automatically; manual work is for issues and the agreed correction pass. Client disconnects cannot reliably be detected server-side.
- Buyers can call the free POST `/api/v1/cabezon/buyer-brief/support` with `{payer,order,kind}`, where kind is `delivery_problem`, `correction_requested`, or `refund_requested`. The exact saved secret-bound order must authenticate against a settled admission. Repeat requests share one ticket per kind/order. Details can be emailed separately using only the order ID, never the secret. Lost secrets require manual support.
- Known authenticated retrieval/delivery failures also queue a notice. Provider acceptance is not inbox confirmation. Provider retries reuse the event ID, stop after ten attempts or 22 hours, and move to `manual_review`; cron returns 503 on failures or manual backlog. Configure deployment/cron failure monitoring outside this email channel and inspect the outbox; do not rely on a broken mail channel to report itself. Keep sender and message template stable while retries are pending. [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Before accepting money, test settlement-to-outbox, duplicate settlement, wrong-secret rejection, provider failure/retry, lease expiry, manual-review escalation, and actual receipt at Mayone's inbox. Verify the route returns unavailable before payment when notification prerequisites are missing. Verify retrieval still works when email is unavailable. The local PostgreSQL test could not initialize because of the host's shared-memory limit; no migration has been applied to production.

No email has been sent by the implementation tests. No refund, payment, deployment, or production configuration change has been performed.

1. Agree with Bryan that this frozen prepared pack is the scope, rather than accepting arbitrary inputs after payment. Proposed limit is five sources / 250,000 source bytes. Agree immediate response delivery, one correction pass requested within seven days, and a two-business-day correction/access remedy or 20 USDC refund after order verification. No fee reimbursement or video is included unless separately agreed. No final commercial acceptance is asserted yet.
2. Freeze the accepted terms and artifact. Update the terms text to remove proposal/disabled wording before release, rebuild the review archive, then obtain agreement to its final digest. After activation **never overwrite version 1.0.0**: retain the exact artifact, terms hash and retrieval support for existing orders; a revision needs versioned archival routing, not replacement of paid bytes.
3. Reconcile these scoped changes onto current main in an isolated release branch; this checkout has unrelated uncommitted work. Do not deploy this whole working tree. Regenerate the public manifest from the reconciled catalogue, not this older branch's catalogue.
4. Confirm deployed Supabase admission table/RPCs, service-role SELECT access, replay protection, Redis capacity and chain confirmation. Test the new route in a controlled environment with mocked/test settlement first. The local suite is not a production DB or facilitator test.
5. Promote only this offer to available and enable it via an additive X402_RESOURCES entry plus `X402_BUYER_BRIEF_ENABLED=true`. Keep other resource bindings unchanged. Verify all sale/metadata surfaces agree, including CARP catalog and index; refresh the signed seller profile through the existing publication process. No paid Bazaar indexing is necessary to make this a CABEZON offer.
6. Verify public GET and unsigned POST show the accepted $20 contract and correct native-USDC/Base/Maha receiver. The client must match the independent pins. Test wrong hash/terms before accepting funds. Then obtain separate authorization for the first real paid test and reconcile the exact USDC Transfer on chain.
7. Verify actual archive delivery and retrieval without repayment. Report discovery, settlement, delivery and acceptance separately. Count as invited, assisted test usage, never organic repeat demand.

## Review commands

Current checks: 104/104 targeted application tests passed, scoped TypeScript check passed, and git diff whitespace check passed. The standalone archive passed 15/15 tests and all 27 file hashes. Archive SHA-256 is `067bb1156b81dc95bb38ab7a0207a9ec4b9541a8b06abe3af8bd2e843c49a003` (71,497 bytes), also recorded in archive-pin.json. The rebuild used `--reuse-snapshots` after a live fetch timed out: original dated public captures were verified against the prior archive pin and retained, not presented as newly fetched. SQL execution, real email receipt, deployed cron and live $20 settlement remain unverified.

```sh
node_modules/.bin/tsc --project tsconfig.buyer-brief.json --noEmit
node --experimental-strip-types --test test/buyer-brief*.test.ts test/x402-gateway.test.ts test/x402-celestial-payment.test.ts test/x402-public-evidence.test.ts test/x402-buyer-delivery-check.test.ts test/x402-readiness.test.ts
node --experimental-strip-types scripts/package-buyer-brief.ts
```

The last command makes three public GETs and one unsigned synthetic quote request, rebuilds a review artifact and runs archive tests. Do not run it to overwrite an activated paid version. Tests use mock signatures and settlement: they do not establish real cryptographic verification, production delivery or revenue. Runtime tested here: Node 26.5.0. Full application build/deployment remains a release-stage check.
