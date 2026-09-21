# CABEZON Buyer-Brief Pack — review release 1

Prepared by Maha Strategies for the invited Octopus demonstration. This is an assisted seller-authored package, not an independent endorsement or an organic-demand result.

**The proposed $20 package purchase is disabled.** This archive is ready for technical and scope review. It is not a deployed $20 offer, an invoice, or permission to transfer funds. `offer.json` lists the outstanding activation gates. Do not pay $20 to the evaluation endpoint: that is a different product.

## What this pack gives Octopus

- A source-linked buyer brief (`BUYER-BRIEF.md`).
- A bounded discovery, authorization and delivery runbook (`RUNBOOK.md`).
- A complete synthetic Deep Context Evaluation request, an expected local result and a deliberately insufficient-budget negative control.
- A one-call purchase adapter with exact quote checks, a request-bound approval and a durable attempt lock. There is deliberately no paid CLI command or bundled wallet.
- Saved public source bytes, acquisition times and SHA-256 hashes; a machine-readable offer, brief and run-report template.

Node.js 22.18+ or 24+; no npm install:

```sh
node --experimental-strip-types --test test/buyer-brief.test.ts
node --experimental-strip-types examples/buyer-brief/run.ts local
node --experimental-strip-types examples/buyer-brief/run.ts request
node --experimental-strip-types examples/buyer-brief/run.ts quote
```

`local` and tests use no network. `quote` sends only the synthetic request, without payment headers, and stops unless the returned terms match the pinned 0.01 USDC evaluation offer. No mode signs or spends. A fresh quote is required at purchase; saved source snapshots are historical observations.

The importable `purchaseEvaluation` in `purchase.ts` takes a caller-controlled signer and an independently approved request digest/expiry. It buys only the example's 0.01 USDC evaluation, not this $20 pack. Using it requires separate authorization. Keep its lock in durable storage shared by all processes for this order; it is not a distributed wallet spending-policy service. Never delete the lock and retry after an ambiguous outcome.

Run `node --experimental-strip-types examples/buyer-brief/run.ts verify` to verify package file hashes. The separately communicated archive SHA-256 is the external integrity pin: a manifest inside an archive alone is not authenticity evidence.

## Proposed commercial scope — agreement required

20 USDC covers one seller-authored pack for one selected Maha service, using at most five agreed public source snapshots and at most 250,000 UTF-8 source-text bytes in total. No private data, live buyer documents, video, independent security audit, open-ended integration or subsequent API purchases. One correction pass for errors against those frozen sources, requested within seven calendar days of delivery.

Proposed delivery: the prepared archive immediately in the paid API response, with secret-bound retrieval without repayment if the response is lost. Acceptance checks are in RUNBOOK.md. Seller-approved remedy: restore access or correct covered defects within two business days; otherwise refund the 20 USDC purchase price after order verification. Wallet/network fees and refund destination verification must be expressly agreed before activation. Contact: mayone@mahastrategies.com. Maha has approved this remedy; Bryan has not yet accepted the purchase terms.

For support, `requestPackSupport(statePath, kind)` in `buy-pack.ts` submits a free authenticated ticket. Kind is `delivery_problem`, `correction_requested`, or `refund_requested`. It uses the saved private order locally and never requests a payment. A queued ticket is not confirmation of email delivery or refund execution. Email any details to Mayone with the order ID only; never email the recovery secret. Seller notices cover recorded purchases and these issues; the pack normally needs no manual fulfillment.

The $20 checkout must bind an order to the exact product/version, source manifest and delivery terms, support retrieval without repayment, and separate settlement, delivery and acceptance. None of those production capabilities is claimed by this review archive.
