# Six demand inspired x402 products local readiness

The owner approved publication and indexing on 12 October 2026. All six contracts
are now declared released, with exact prices and the separate runtime flag
`X402_DEMAND6_ENABLED=true`. Production build and paid indexing verification are
pending at this source snapshot. The 155 existing active offers are preserved.
Research briefs use exact source excerpts, not a language model.
This implementation does not establish customer demand or measured profitability.

The work is in `/private/tmp/maha-base-arbitrum-science50`, on
`codex/x402-observability-demand-20261012`, following local commit `05c55483`.
The primary workspace and its unrelated changes are preserved. The approved
release includes the preceding catalogue/monitoring repairs in commit `05c55483`.
One focused build and one Base purchase per new product are planned; the total
service-payment cap is 0.4629 USDC, with no automatic repayments or model spending.

## Products and prices

Each exact POST path is `/api/v1/demand/` followed by the identifier below.
GET describes the contract and an original synthetic example; it does not run
the service over supplied input. Prices are USDC, with six decimal places.

| Product identifier | Price USDC | Service and principal limit |
| --- | ---: | --- |
| `csv-import-preflight` | 0.0135 | Parse up to 500 CSV records against declared columns and scalar types; report quoting, header, shape and formula-prefix findings. No cell execution, repair or PII detection. |
| `live-x402-payment-preflight` | 0.0349 | Read one approved public endpoint's unpaid challenge; check Base and Arbitrum native-USDC terms against the declared payee and cap. A quote does not establish settlement or delivery. |
| `x402-quote-change-report` | 0.062 | Compare at least two dated observations over a maximum 30-day window; expose quote/schema changes, snapshot age and sampling gaps. No continuous uptime claim. |
| `product-catalogue-preflight` | 0.0245 | Check up to 250 product records for duplicate SKUs, decimal prices, currency shape and optional GTIN check digits. No identifier ownership or marketplace approval. |
| `live-citation-recheck` | 0.088 | Fetch up to three approved text sources; locate exact quotes and compare declared previous text hashes. Presence is not factual support. |
| `source-bound-research-microbrief` | 0.24 | Extract short, query-overlapping source excerpts for one narrow question, with links, locators, hashes and unknowns. Zero model calls; no invented answer or factual certification. |

All six prices are distinct from current and declared historical offer prices.
Price uniqueness helps existing amount-based observations; it does not prove
which API a transfer purchased.

## Public targets and source rights

Live endpoint checks initially accept only exact URLs of existing released Maha
offers. Quote history currently covers only Context Compiler. An endpoint with
fewer than two stored observations returns a refusal before settlement, not a
fabricated report. Additional providers require an operator-reviewed registry.

Citation and research sources initially consist of these Maha-owned pages:

- `https://www.mahastrategies.com/tools/context-review`
- `https://www.mahastrategies.com/research/mcp`
- `https://www.mahastrategies.com/developers`

New sources require a documented reuse basis. The versioned extractor excludes
forms, code, navigation, scripts and styles. It does not execute JavaScript,
render browser visibility, open PDFs or bypass paywalls. Exact quote positions
refer to Unicode code points in the extracted text, not raw HTML or DOM offsets.
The brief returns at most six excerpts, with at most two per source and 25 words
per excerpt; it reports insufficient evidence when none overlap the question.

The reader accepts registered HTTPS targets without credentials, query strings,
redirects or IP literals. It rejects private/special DNS addresses and pins a
validated public IPv4 address into the TLS connection while checking the original
hostname. IPv6 is unsupported in version 1. DNS and request deadlines are four
and ten seconds, respectively; the response body is capped at 128 KiB, with
compression disabled and fatal UTF-8 decoding. UTF-8 BOM bytes are preserved for
raw-byte hashing.

## Input and result bounds

Strict schemas refuse unknown fields and accept only caller-labelled public or
synthetic input. Labels and hashes are not sensitive-data detection or
anonymization. Never submit private records, passwords or payment credentials.

Requests are capped at 32 KiB with a five-second streaming deadline. CSV fields
are capped at 1,000 characters and 64 columns. Findings are capped at 300, with
truncation explicitly reported. Results are capped at 64 KiB. Each offer has a
four-request local work limit per worker, a two-slot distributed preparation
limit before facilitator verification/public reads, and a separate two-slot
settlement capacity limit. Preparation slots expire after 90 seconds and release
in the handler's cleanup. Future volume and real costs still require measurement.

Input, result and receipt digests bind the product and implementation version.
They are unsigned integrity hashes, not authenticity, factual correctness,
trusted time or buyer-delivery proof. Discovery records, OpenAPI schemas and
the public manifest describe these offers as released. A live 402 quote, not the
manifest alone, establishes deployment enablement.

## Payment and recovery

Version 1 supports native-USDC EOA signatures on Base and Arbitrum; it does not
support smart-contract-wallet signatures. The route validates the signed payer,
asset, payee, amount, resource, timing and body commitment before preparation.
Fresh work also requires facilitator verification without settlement. Supported
negative findings are results; unavailable or unsupported work is refused before
payment. Production requires explicit cohort enablement; preview remains disabled.

Before signing, the buyer must privately save the exact JSON input, input hash,
random 32-byte recovery secret and original signed authorization. The EIP-3009
nonce commits to the product version, product identifier, input hash and recovery
secret. Use `demandPurchaseHeaders` and `demandPurchaseTypedData`; a generic random
nonce will not satisfy this purchase contract.

The prepared result is stored before settlement. Production requires the
configured Redis store and fails closed if retention is unavailable. A per-nonce
lock prevents concurrent preparation/settlement, and lock ownership is checked
again before payment. Cache identity uses the native authorization's network,
asset, payer and nonce, not unsigned metadata or signature encoding.

The same original authorization can recover a retained paid result for up to
24 hours from first preparation, without a new fetch or settlement, even after
the authorization expires. Retention excludes raw input, CSV cells, full source
bodies, raw signatures and recovery secrets. Results may retain short quotations,
payer/network metadata and the settlement receipt. Save the delivered result.

Corrupt evidence, mismatched receipts, stale prepared results, unknown settlement
outcomes and unavailable recovery require operator review. Never automatically
sign a replacement payment. If a post-payment retention write fails, the route
still returns the paid result and marks `X-Maha-Result-Retained: false`; recovery
must not be promised in that case.

## Verification

The 73 product and indexing tests passed, including strict schemas, exact quote locations,
CSV/GTIN checks, SSRF boundaries, source-rights checks, 12 mocked paid/recovery
flows and 12 integrations through the real gateway code on Base and Arbitrum.
The latter mock facilitator, ledger, chain confirmation and capacity services;
they are not mainnet settlements. Recovery expiry, receipt corruption, lock loss,
input tampering and oversized bodies also passed.

The separate catalogue, challenge, gateway, settlement, multichain and science
regression run passed all 599 tests, with no failures or skips. TypeScript and
scoped ESLint passed. Before activation, all six local HTTP GETs returned
contracts, OPTIONS returned 204, and unpaid execution returned 503. Synthetic examples
regenerated byte-identically and static discovery synchronization passed.

The real production Redis store passed an isolated synthetic round trip,
owner-checked locking and expiry check (86,399 seconds remaining). Only exact,
unpredictable task-owned keys were touched and removed. No customer record or
payment was accessed. The indexing workflow validates every unpaid challenge
before exposing the signer; checks stable nonces against the token contract;
persists original authorizations in authenticated encrypted recovery capsules;
and stops the batch on any uncertain settlement or delivery. Publisher-funded
payments are operator activity, never customer revenue or organic demand.

Two legacy documentation checks still fail outside the six-product suite:
`openapi-docs.test.ts` omits the existing `/api/admin/civic-ai-safety` route from
its documented/private list, and `agentic-commerce.test.ts` uses an old capability
list that already disagrees with the prior 160-capability manifest. These checks
were not bypassed or rewritten to conceal the mismatch. New OpenAPI operations
have declared tags, exact schemas and explicit release status; structural
OpenAPI validation passes. The entire repository suite is not claimed green.

Unpaid public checks used the pinned reader. Two Context Compiler observations
were saved at `2026-10-12T08:43:18.524Z`; both offered valid 0.001-USDC quotes on
Base and Arbitrum. They are closely spaced samples, not uptime or customer calls.
At `2026-10-12T08:55:18.370Z`, the extractive brief returned exact Context Review
prose, excluded form/example text and recorded zero model calls. No payment,
signing key or facilitator settlement was involved. Two additional unpaid quote
observations were collected at `2026-10-12T09:35:14.662Z`, bringing stored history
to four observations without asserting continuous uptime.

Run from the checkout above:

```sh
npm run test:x402-demand6
npm run generate:x402-demand6
node --experimental-strip-types scripts/sync-demand6-discovery.ts --check
npm run typecheck
```

`generate:x402-demand6` writes only local synthetic examples. The separate
`collect-demand6-quote-history.ts --collect` command makes two unpaid public
observations and updates the local history artifact; no schedule was activated.

## Launch checks and operating limits

1. Review approved provider/source coverage, reuse rights, expected utility and
   price economics. General web research or arbitrary endpoint testing is not
   part of this version's approved registry.
2. Verify served schemas and native-USDC quotes on both networks after the one
   authorized build. Mainnet indexing uses Base only; no Arbitrum payment is approved.
3. Run `demand6-indexing.yml` once with its exact confirmation. Verify all six
   receipts, exact chain transfers, delivered hashes and retained results, then
   perform a complete paginated Bazaar lookup. Stop on uncertainty; do not repay.
4. Keep listing, quote, settlement and delivery separate. Pending index metrics
   are not zero calls; operator indexing activity is not customer growth.
5. Preserve encrypted recovery capsules and the dedicated key for operator-led
   recovery. Investigate missing delivery before considering a new payment;
   any later build, paid refresh or expansion needs its own authorization.
