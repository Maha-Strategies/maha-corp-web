# x402 Buyer Compatibility and Discovery Attribution

The six demand products need an input-bound payment adapter. Unmodified x402 EVM clients generate a random authorization nonce and are refused before work or settlement. The local adapter preserves the binding and recovers a retained response with the original authorization. Attribution changes are local and require the database migration before a separately approved production build.

## Buyer Tests

The installed independent `@x402/fetch` and `@x402/evm` clients (both pinned to 2.28.0 as direct development dependencies) were tested against the real local handlers for each of six products on Base and Arbitrum. All twelve unmodified-client attempts returned 400 without work or settlement. All twelve adapted purchase and recovery scenarios passed with one fixture signature and one mocked settlement each. These are local transport tests, not new mainnet payments or independent paid delivery tests.

Run the safe example from the repository root:

```sh
node --experimental-strip-types scripts/run-demand6-buyer-example.ts
node --experimental-strip-types --test test/x402-demand6-buyer.test.ts
```

The example uses synthetic data, an unfunded public fixture key, an in-memory outbox and mocked network/payment dependencies. It accepts no live-payment option. Production buyers must provide a durable private outbox and an approved signer; the adapter has no wallet key or automatic repayment loop.

```ts
import { prepareDemandPurchase, submitDemandPurchase } from './lib/x402/demand6/buyer.ts'

// These application-provided functions must save private bearer evidence
// durably before submission. Encrypt it at rest; never put it in logs/Git.
const capsule = await prepareDemandPurchase({
  productId: 'csv-import-preflight',
  input: approvedSyntheticInput,
  network: 'eip155:8453',
  payer: connectedWalletAddress,
  maximumAmount: BigInt(13500),
  signTypedData: approvedWalletSigner,
  persist: savePrivateEncryptedOutbox,
  discoverySource: 'alsp',
})
const result = await submitDemandPurchase(capsule)

// If a response is lost, recover explicitly from the ORIGINAL private capsule.
// Do not run prepareDemandPurchase again or wrap recovery in automatic payment.
const recovery = await submitDemandPurchase(await loadPrivateEncryptedOutbox())
```

`provider_reported` settlement is a matching merchant receipt, not independent chain confirmation. `validated_response` means a received body passes the product schema, exact input hash, result hash and receipt digest; it is not semantic correctness, provider signature authentication, or evidence of customer value. Empty or invalid bodies remain unresolved even with a receipt. Recovery remains subject to the published 24-hour retention limit and operator review when original output is unavailable.

## ALSP Artifact Review

The public sample was inspected at commit `763d68c3218f29452990b87964e8808ffd0ac083`, referring to ALSP implementation `545221097a48cb6480c58b5d43e05f302acef30f`. The review parses JSON only and does not install or execute upstream code, reproduce its generator, verify archive hash chains or interpret mock RPC observations as chain evidence.

| Scenario | Native session state | Output available | Settlement evidence in native export |
| --- | --- | --- | --- |
| Success | CLOSED | Synthetic body | Mock only |
| Lost response | RECONCILIATION_REQUIRED | No | Absent |
| Bodyless reconciliation | CLOSED | No | Mock only |
| Empty HTTP 200 | CLOSED | No | Mock only |

The companion field mapping correctly distinguishes ALSP's endpoint-plus-normalized-input request hash from Maha's bare canonical input digest. Offer versions and delivery observations are companion annotations, not signed provider terms. The current POST transport supplies flat query parameters instead of the nested JSON body required by Context Compiler.

An initial integration should add JSON POST support and explicit output availability without treating CLOSED or VERIFIED as delivery. Reconciliation must accept independently checked settlement evidence even when no response was captured, while leaving delivery unresolved. It must not authorize a replacement payment or imply a refund. Public support exports should use synthetic/redacted data; an ordinary native archive can contain raw input and output.

Pinned artifact SHA-256 values:

- `samples.json`: `96a1862425ae252986bb3895d7ed9be7722f89cd51ed3b68e42509f6d3aad72c`
- `maha-public-mapping.json`: `756f4c41de857ae58fcb93eac1eb25f79cc6624f05e4f968b4793387bc3653ff`
- `source-manifest.json`: `406669823edba64e0da633f0a715e46e1579765f2b02cad5801d36d6661122af`

Read-only reinspection:

```sh
node --experimental-strip-types scripts/review-alsp-maha-sample.ts
```

## Discovery Measurement

`X-Maha-Discovery-Source` accepts a fixed set: bazaar, maha_canary, direct, reddit, alsp, nohumans, tanod, nsgoods, unknown. It is caller-controlled attribution, not a buyer identity, verified referral, security signal or entitlement to commissions. Unknown values are not retained verbatim. Domain matching no longer accepts deceptive suffixes such as `evilmahastrategies.com`.

Existing aggregate quote/response telemetry supports those labels. For the six demand products, private purchase attribution is keyed by chain and canonical authorization fingerprint. It records confirmed/unknown settlement separately from a prepared server response. The first source is preserved during recovery; retries cannot create new purchase rows, and later unknown observations cannot downgrade a confirmed record. Known operator wallets are identified from the verified payer, not a spoofable user agent or source label.

The private table contains a chain-scoped wallet pseudonym, amount, transaction reference, source and outcome counters. Pseudonyms are not anonymity: known public wallet addresses can be matched. It stores no raw inputs, source text, IPs, unrestricted referrers, signatures or recovery secrets. Anonymous/authenticated roles cannot read or write it; service-role writes use the restricted RPC. Purchase reports use a 90-day window from first observation, with bounded cleanup in the existing authenticated hourly settlement job. Cleanup does not delete financial or replay-protection ledgers. The public disclosure and technical review are recorded in [x402-privacy-review-2026-10-12.md](./x402-privacy-review-2026-10-12.md).

The aggregate report identifies repeated chain-wallet/offer pairs, not people or companies. Known operator purchases are separate; other external transfers are not automatically organic customers. The report refuses missing schemas and partial pagination instead of reporting zero. Historical quote coverage predates the new receipt-linked records, so the report does not calculate a causal conversion percentage or backfill referral history.

```sh
node --experimental-strip-types scripts/report-x402-discovery-attribution.ts
```

Apply `20261012120000_x402_discovery_attribution.sql` before activation. It was exercised in an isolated local PostgreSQL database seeded with the existing telemetry migration, then tested with `test/fixtures/x402-attribution-assertions.sql`. Replay counts, monotonic settlement/source behavior, identity conflicts, RLS and role grants passed. The test database was stopped. The production migration has not been applied.

## Live Checks

The scheduled refresh recovered without a production change. The live health response at `2026-10-12T10:17:12.305Z` reported fresh, caught-up snapshots on Base through block 52504883 and Arbitrum through block 514080006. All six demand-product indexing transaction hashes were subsequently present in the rendered settlement page. No backfill or payment was made for this check.

ContextIQ's free Inspector was given only the public CSV endpoint URL. It read GET, saw the free description response and reported no payment required. An independent direct unpaid POST returned 402 with native-USDC options on Base and Arbitrum at 13500 base units each. The Inspector result therefore does not cover the paid method. x402 Doctor's Reddit post did not supply a runnable URL, and no Doctor result is claimed.

## Release Boundary

The user approved migration `20261012120000` and one focused production build on 12 October, plus temporary access for the exact reviewed workflow branch with the reviewer gate intact. The protected dry-run and single apply passed; the temporary permission was removed and main-only access verified. Deployment remains pending. No additional live paid call or wallet-key access is authorized. Prices, nonce binding, the settlement schedule and unrelated local work are unchanged. New support/attribution recording cannot withhold a paid response if accounting is unavailable.

## Verification and Communications

The focused suite passed 179 tests: 174 buyer, attribution, ALSP, product-usage, readiness, settlement and observability tests, plus five RPC-provider tests. The RPC tests required permission to bind their local fixture server; they passed when rerun with that permission. TypeScript, scoped ESLint and `git diff --check` passed. The offline buyer example and isolated PostgreSQL migration assertions passed separately. This is not a claim that the complete repository test suite or a production build passed.

The [ALSP review reply](https://www.reddit.com/r/x402/comments/1x35eeq/comment/pff88tu/) was posted. After explicit user approval, the [existing catalogue post](https://www.reddit.com/r/x402/comments/1x35eeq/our_x402_catalogue_is_live_looking_for_recurring/) was saved and visually verified with 156 observed listings, both payment networks, the caught-up ledger and operator/customer distinctions. Neither communication claims paid ALSP interoperability or organic demand from publisher indexing.

The subsequent JSON-POST fixture at `cd7b3264ed39d610d4b89f6fe7d121a61c9687d8` was reviewed through its README, manifest and redacted lost-no-wire export. The new [reply](https://www.reddit.com/r/x402/comments/1x35eeq/comment/pffxpfc/) confirms the offline boundary and asks for request/output-schema and non-ASCII-input checks. The generator and its reported 112-test suite were not executed or independently reproduced here.

Sources: [ALSP sample](https://github.com/Kairose-master/ALSP/tree/763d68c3218f29452990b87964e8808ffd0ac083/docs/examples/maha-offline-session-sample), [ALSP reply](https://www.reddit.com/r/x402/comments/1x35eeq/comment/pfelj2p/), [independent SDK](https://github.com/coinbase/x402/tree/main/typescript/packages/fetch), [free Inspector](https://contextiq.trango-compute.com/x402-inspector), [settlement health](https://www.mahastrategies.com/api/health/x402-settlements).
