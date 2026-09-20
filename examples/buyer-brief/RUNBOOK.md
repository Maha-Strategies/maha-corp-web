# Octopus runbook

## A. Review without spending

1. Verify the archive against the digest received separately from Mayone. Extract into a new directory. Inspect the files before running code; no root, Docker, installation or private keys are required.
2. Run the offline tests, `local`, and `verify` commands in README. Confirm the normal case retains four labelled spans and the negative case stops. Review `offer.json`; **purchaseEnabled must remain false until the $20 delivery path is deployed and agreed**.
3. Use Octopus's existing configured El-Cabezon connection to discover Maha, not a fabricated registry URL. Retain the directory response hash and timestamp. If using the direct catalogue as fallback, record `direct_link_fallback`, not successful directory discovery.
4. Verify the current DID/SAD via Nautilus using independently established keys and revocation policy. Query Glassfish using its declared interface. Record unavailable, empty, negative and positive results separately. A signature does not authorize a wallet destination by itself.
5. Record timenow liveness separately from discovery and catalogue parsing. No workaround granting general WAF exemptions or access is authorized.

## B. Buy the $20 pack — currently STOP

Before this step, Mayone and Bryan must agree the selected source snapshot hashes, scope, price, delivery window, retrieval instructions, correction/refund terms and any additional fees. Maha must publish and verify the implemented $20 order-bound offer and delivery path. Then Octopus must rediscover that offer and verify its product ID and version. The local implementation is not a live $20 quote; this release supplies a guarded adapter in `examples/buyer-brief/buy-pack.ts` but no automatic paid command.

After activation, GET `https://www.mahastrategies.com/api/v1/cabezon/buyer-brief` for the contract. Confirm its archive and terms hashes against the independently agreed pins. `preparePackOrder(approvedBundleHash)` generates a fresh order and secret. Bryan's approval must name `briefOrderHash(order)`, 20,000,000 base units, an expiry and an approval reference. Call `purchasePack` only from the buyer's signer-controlled application, with that order, approval and a private durable state-file path. The client pins Base/native USDC/Maha's recipient and refuses any changed terms. Its reserved state is saved before signing and is not deleted on failure.

The response contains the reviewed archive as base64 plus its digest. The client verifies order and archive bytes before returning them. If delivery is lost, `recoverPack(statePath)` POSTs the saved payer and exact order (including the private recovery secret) to `/api/v1/cabezon/buyer-brief/retrieve`. It sends no payment header and requests no new signature. Keep that state file private; possession of its secret grants recovery of this paid artifact. An unavailable response requires seller reconciliation, not another purchase. Production activation and this recovery path remain to be verified before Bryan is invited to pay.

Bryan must approve exactly 20,000,000 native-USDC base units, the correct Base chain, payee, resource, order and terms. Additional fees require a separately stated cap; no token allowance, bridge, swap or direct wallet transfer substitutes for the order flow. Stop if the quote omits or changes any approved field. One authorized purchase attempt only; on timeout or unclear settlement, reconcile that attempt before any new signature.

Retrieve the purchased archive through the agreed order channel without paying again. Check its externally pinned digest and file manifest, run the tests, inspect all deliverables and record acceptance or the precise defect. A signed report describes these observations; it does not convert them into verified quality.

## C. Optional later 0.01 USDC API use — separate approval

The delivered example can be used without buying any API call. If Bryan subsequently authorizes the evaluation, `run.ts request` emits the exact synthetic input and `run.ts quote` checks current terms without paying. Integrate `purchaseEvaluation` with Octopus's own secure signer, pass an approval referencing the exact request SHA-256 and an expiry, and provide a durable attempt-lock path for this order. Never put a private key or payment signature in email or this archive.

The adapter reserves its one attempt before invoking the signer, retries the HTTP request once with the signed authorization, validates the result and retains the reservation even if anything fails. No automatic re-signing, fallback payment, or second compiler call. Any caught error means STOP_AND_RECONCILE; do not trust a generic HTTP status as proof nothing settled.

Independently check Base chain ID, successful receipt and native-USDC Transfer log: buyer, approved recipient and exact amount. Retain block/transaction references, not a reusable payment authorization. This reconciliation is a buyer/operator check, not implemented by the example. Network fees, if any, need their own approval; the example only bounds the USDC transfer.

## D. Evidence and acceptance

Use `run-report.template.json`. Keep discovery, identity verification, reputation, quote, authorization, settlement, package delivery, output checks and buyer acceptance as distinct observations, with unavailable fields left null. Never include secrets, raw PAYMENT-SIGNATURE headers or unredacted buyer documents. Publish only a reviewed sanitized copy with Bryan's agreement; signing/publication are not automatic.

Acceptance: listed files present, externally pinned archive digest correct, tests pass, request executable without hidden credentials, sources traceable, stop conditions demonstrated, all limitations disclosed. Commercial acceptance also needs Bryan's explicit confirmation of usefulness; tests alone cannot supply that.

Classify the purchase as invited, assisted and test-purpose. A later self-funded real-work repeat is a separate observation with its own evidence and observation window. No promotional video or revenue claim before actual outcomes.
