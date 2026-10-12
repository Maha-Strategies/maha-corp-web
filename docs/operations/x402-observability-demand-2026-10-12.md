# x402 observability and discovery improvements — 12 October 2026

## Release boundary

Implemented and tested locally in the production-based checkout
`/private/tmp/maha-base-arbitrum-science50`, branch
`codex/x402-observability-demand-20261012`, based on
`cead374c63e54d120802ea333b31bd7bc201fcb3`.

This change has not been pushed, deployed or activated in GitHub. No Vercel
build credits, paid API calls, wallet signatures, dependency installations,
private-code uploads, DNS changes or settlement-store writes were made.
Unrelated work in the primary checkout is unchanged.

## What changed

1. Shared catalogue pagination covers up to 1,000 resources, including all
   150 expected current listings. Inactivity monitoring, the bounded canary
   lookup and market analysis use this reader. Changed totals, duplicated
   resources, truncated pages, wrong merchants and failed reads are failures,
   not evidence that an endpoint disappeared. Market analysis no longer
   rejects inventories merely for exceeding 128 products.
2. The owner's five deliberately unindexed higher-priced offers are reported
   separately. Unknown observations cannot be masked by another offer's warning.
   Existing inactivity incidents only close after a complete healthy observation.
3. Six descriptions now state the caller's problem, supplied inputs, returned
   outputs and limitations: challenge sanity, retry-trace audit,
   settlement/delivery reconciliation, evidence-brief export,
   reproducibility-manifest builder and audit-export normalizer. Prices, routes,
   launch status and input/output schemas are unchanged. JSON audit normalization
   is explicitly not CSV parsing; exports are not new research; offline checks
   are not live provider monitoring. Agent-card and offer JSON are synchronized.
4. The observation command reports listing, two-chain payment quotes,
   amount-attributed transfers and recorded server responses independently.
   Complete, chronologically ordered snapshots can be compared. Absence alone
   never authorizes a paid refresh. Unknown evidence is not rendered as zero.
5. The settlement watcher optionally reads receipts to distinguish native-USDC
   transfers with matching `AuthorizationUsed` evidence, transfers without that
   evidence, and unknown mechanisms. Both Base and Arbitrum assets are checked.
   Known operators and the exact assisted $20 CABEZON test remain separate from
   the new external mechanism statistics. Legacy price-match statistics remain
   compatibility observations, not verified product revenue.
6. Free demand-feed and Tanod diagnostics are opt-in, read-only and bounded.
   Tanod calls explicitly request its free allowance and stop at a 402; they
   never sign, pay, retry with money, install packages or upload private code.
   Domain/TLS and compiler-presence history use fixed public Maha targets.

## Evidence stages and boundaries

| Stage | Supported observation | Not established |
| --- | --- | --- |
| Listing | Exact URL in a complete dated catalogue | Endpoint death, successful payment or delivery |
| Payability | Valid 402 quote, exact amount/payee/native USDC/domain on each network | Actual settlement or usable result |
| Transfer mechanism | Matching native-USDC Transfer and authorization event in the same verified receipt | x402 route, API execution, independent demand |
| Product attribution | Price-matching counts from a fresh caught-up stored ledger | Exact purchased API or organic revenue |
| Server response | Existing aggregate invocation records | Buyer receipt or usefulness |
| Third-party signal | Dated search, census or DNS/TLS observation | Unmet demand, buyers, continuous availability or security clearance |

Several transfers/authorizations by the same payer in one receipt remain
unknown when pairing is ambiguous. Unavailable or mismatched receipts also
remain unknown. Receipt inspection is cached by transaction and capped at 200
transactions per watch by default; unsampled entries are explicitly unknown.
The saved live-ledger schema, history, digest and refresh cursors are unchanged.

The old scheduled canary no longer treats a missing listing or timestamp as a
reason to spend. A valid observed stale timestamp can still invoke the existing
approved bounded canary policy. A deliberate manual metadata refresh still
requires explicit spending authorization and all existing guards.

## Commands

Run from the checkout above:

```sh
npm run test:x402-observability
npm run typecheck
npm run watch:x402-inactivity
npm run observe:x402-products
npm run observe:x402-products -- --offer x402-challenge-sanity
npm run observe:x402-products -- --previous /absolute/path/prior-observation.json
npm run inspect:x402-signals -- --tanod --tanod-infrastructure
```

`--previous` accepts either a previous report containing `inventorySnapshot` or
the raw complete snapshot. Incomparable snapshots are identified, not diffed.
The quote observer uses bounded synthetic/public discovery examples without
payment signatures. It performs no paid delivery test.

`--with-usage` reads the existing aggregate response meter when its configuration
is available. `--with-stored-settlements` reads the existing stored ledger and
does not scan RPC or write a refresh. Stale, fallback, incomplete and ambiguous
product attributions remain unknown. Do not copy secrets into a report.

For a read-only receipt-aware chain watch:

```sh
node --experimental-strip-types scripts/watch-x402-settlements.ts \
  --network eip155:8453 --days 2 --classify-authorizations --receipt-limit 200
```

Use `eip155:42161` for Arbitrum. RPC configuration and chain identity are checked;
production still requires the existing network-specific environment settings.
No signing key is needed. The local workflow change enables bounded receipt
inspection on the existing watch without changing its schedule or permissions.

## Read-only live observations

- Complete Bazaar observation on 12 October: **150 resources and 150 expected
  listings, none missing**, with five deliberately unindexed offers outside the
  expected set. The only inactivity warning was `cabezon-buyer-brief-pack`, last
  called `2026-09-25T21:02:49.377Z`, with approximately 13.57 days of remaining
  margin at observation time. No urgent warnings or refresh payments occurred.
- At `2026-10-12T07:18:36.606Z`, all **155 active products** returned valid unpaid
  quotes on **both Base and Arbitrum**: 310 network quote observations, no
  invalid or missing-network quotes. Delivery was not tested.
- At `2026-10-12T07:31:37.242Z`, six supplied recent external Base transfers,
  totaling **0.0365 USDC from one wallet**, all had matching native-USDC
  authorization evidence. The official Base RPC returned their receipts. A
  separate public RPC returned an invalid-parameter error for the same lookup;
  that first attempt correctly produced unknown classifications, not ordinary
  transfers. Production receipt coverage must be checked after publication.
- The free demand feed's source window ended seven days before generation;
  21 relevant terms were selected during the check. IP counts are not buyers,
  catalogue matches are competition signals and no unmet demand was inferred.
  The parser checks the declared delay against the timestamps.
- Tanod's free query returned 50 public Maha records and marked the result
  partial. It cannot establish absence for the rest of the catalogue.
- Tanod's free DNS/TLS check observed reachable, trusted TLS covering
  `mahastrategies.com`, with certificate expiry `2026-12-28T04:51:56+00:00`.
  Its compiler-history response observed six dated catalogue-presence entries,
  7–12 October, at $0.001. These are third-party observations, not payments,
  an independent security audit or evidence of customer demand.
- Tanod package scanning is not activated in this change; no package or private
  repository was submitted to a scanner.

## Before publication

1. Review the focused diff and obtain approval for any Git operation or deployment
   that would consume Vercel build credits.
2. Keep the deployment's `X402_RESOURCES` enablement configuration consistent with
   the six updated catalogue descriptions. Do not change prices, payment networks,
   capabilities or enablement as part of a copy update.
3. Publish the tested monitoring workflow changes without creating new paid
   schedules. Verify receipt availability on each configured RPC. Unknown is a
   coverage problem to investigate, not zero activity or permission to repay.
4. Compare a subsequent complete catalogue snapshot and inspect live quotes;
   investigate server failures independently. Never pay merely to clear a
   missing-listing alert. Any refresh still needs its separate spending approval.

## Local verification

- Focused observability, pagination, inactivity, discovery and transfer tests:
  **66 passed**, no failures or skips.
- Catalogue, challenges, gateway, public evidence, microproduct, science-product,
  ledger, refresh and multichain regression tests: **541 passed**, no failures or skips.
- `next typegen` and TypeScript checks passed.
- ESLint passed for the new modules, updated monitors and associated tests.
- Both changed workflow files parsed successfully as YAML; no workflow was run
  or published by this verification.
- Discovery generators completed locally with zero network calls or payments;
  the generated public manifest and conformance result remained unchanged.

## Sources

- [Demand-feed context](https://nohumans.directory/state/demand) and
  [JSON feed](https://api.nohumans.directory/v1/demand): delayed public search data,
  not transactions or buyer identities.
- [NSGoods payability report](https://x402.nsgoods.org/proof/payability-report-2026-10-11.html):
  catalogue absence, payment challenges and delivery are different observations.
- [USDC event-method discussion](https://www.reddit.com/r/x402/comments/1x3ljti/i_counted_10_weeks_of_usdc_payments_to_220_x402/)
  and [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009): authorization event
  semantics and limits of route attribution.
- [Tanod documentation](https://tanod.dev/) and
  [request schemas](https://tanod.dev/openapi.json): explicit free-tier header,
  public catalogue/history and domain-check interfaces.
