# Ten x402 microproducts: local implementation and release checklist

Status: implemented locally, all ten withheld. No push, Vercel build, Preview,
deployment, Bazaar registration, live settlement or new credentials were authorized
or performed. This does not change the existing three celestial products.

## Catalog

Each exact POST path is `/api/v1/micro/` followed by the identifier below.
GET returns a free contract and example, not execution over caller input.
Prices are USDC with six decimal places; `5000` and `10000` base units respectively.

| Identifier | Price | Bounded service |
| --- | ---: | --- |
| citation-binding-check | $0.005 | Compare up to 20 declared identities, revisions and locators; no source fetch or claim verification. |
| revision-lineage-check | $0.005 | Check one declared revision transition; no authenticity or inherited approval. |
| audit-export-normalizer | $0.01 | Sort and fingerprint up to 100 metadata events; no proof of occurrence or completeness. |
| dimensional-consistency-check | $0.005 | Multiply/divide two SI dimension vectors; no unit conversion or model validation. |
| exact-interpolation-receipt | $0.005 | Two-point, in-range interpolation with exact rational arithmetic. |
| sampled-series-integration | $0.01 | Composite trapezoidal arithmetic over 2–128 equally spaced integer samples; not an exact underlying integral. |
| evidence-conflict-comparator | $0.01 | Compare 2–20 caller-labelled observations within one claim/population/outcome; no independent consensus assessment. |
| release-bound-evidence-packet | $0.01 | Allowlisted public metadata pinned to a matching repository release and revision. |
| tiruvaymoli-context-packet | $0.005 | Named atlas unit, edition/locator metadata and five existing bounded Maha answers. No source full text or new translation. |
| astrology-experiment-plan-check | $0.01 | Check a structured, public/synthetic low-stakes plan; no prediction, power analysis or registration. |

## Implementation boundaries

- All offers are `withheld` and `payableInProduction: false`. POST additionally
  refuses every environment except explicit local development/test, before payment
  resolution. An accidental resource configuration cannot enable Preview/Production.
- Existing fourteen offers keep their prices and payment availability. The ten new
  declarations are absent from the payable catalog. No external indexing is performed.
- Strict input/output schemas, unknown-field refusal, 32 KiB streaming request cap,
  five-second body deadline, four concurrent local computations per offer/worker,
  64 KiB result cap and distributed capacity reservation before settlement.
- Deterministic work finishes before settlement. No result is returned on a challenge,
  refusal, replay, missing ledger, exhausted slot or contradictory chain evidence.
- Integrity receipts bind input, version, result and amount. They are unsigned hashes,
  not evidence of truth, trusted time, expert review, anonymity or customer receipt.
- Request/result bodies and their digests are not persisted by this service. Existing
  settlement metadata still includes transaction, payer, resource, amount and status.
  Coarse offer/status telemetry contains no submitted fields. Do not submit secrets.
- Stateless delivery has **no stored-result recovery**. A lost paid response cannot
  be replayed for delivery; checking settlement and resolving a refund/recovery request
  must precede any new payment. Do not advertise durable delivery until implemented.

## Corpus and scientific scope

The release packet uses the committed federation implementation/ledger/index snapshot,
not a fresh Production database observation. It verifies exact hashes, active status,
recorded review and dependencies, and host/path identity. This is not coverage of every
historical route. A withdrawal after that snapshot requires a refreshed deployment or
a separately reviewed live release check before this product can promise live status.

The Tiruvaymoli packet uses the existing atlas registry and recorded publication
baseline. It does not acquire sources, transfer translation rights, independently
inspect passages or turn textual interpretation into historical/theological proof.

The astrology checker is a deliberately smaller public contract than the private
hypothesis registry: synthetic tasks/public puzzles only; fixed structured declarations.
It does not establish that a supplied time was observed, that randomization occurred,
that conventions are valid, or that a digest represents a registered protocol.

Exact arithmetic does not remove model, sampling or measurement uncertainty.
Uncertainty and approximation error are explicitly not estimated. Conflict labels,
source identity and event records remain caller declarations.

## Local verification commands

Run from the repository root. These commands do not trigger a Vercel build.

```sh
node --experimental-strip-types scripts/generate-microproduct-examples.ts --check
node --experimental-strip-types scripts/sync-microproduct-discovery.ts --check
node --test --experimental-strip-types test/x402-microproducts.test.ts test/x402-micro-payment.test.ts
node --test --experimental-strip-types test/x402-*.test.ts test/openapi-docs.test.ts test/agentic-commerce.test.ts
npm run typecheck
node --experimental-strip-types scripts/benchmark-microproducts.ts
```

Golden input/output examples are in `content/discovery/microproduct-examples.json`.
The async `verifyMicroProduct` recomputes the whole result; the synchronous existing
buyer capture checker checks schema, captured bytes, input binding and receipt hash.
Do not confuse that latter check with independent recomputation or live buyer proof.

Synthetic tests inject facilitator, ledger, chain observation, slot release and
telemetry. They prohibit HTTP. They exercise all ten paid flows plus wrong-price and
wrong-offer payments, concurrent replay, malformed/stale inputs, capacity exhaustion,
settlement ambiguity, cleanup/telemetry errors and losing the delivered body.

First full-suite run: 4,483 tests, 4,452 passed, 31 failed. Two genuine integration
gaps (discovery expectations and OpenAPI coverage) were corrected; the rest involved
sandbox-blocked local server/PostgreSQL setup and two clean-worktree guards. Final
clean-worktree verification results are recorded below when available. No assertion
was disabled to bypass the environment failures.

Local example benchmark (31 calls per product, no provider/DB/network): warm p95
below 0.2 ms for the eight non-corpus operations, about 27 ms for the release packet
and 2.7 ms for the atlas packet; responses 1.2–7.1 KiB. These are example-only laptop
measurements, not worst-case throughput, facilitator latency, Vercel billing or margins.

## Required before launch — not performed

1. Review the exact diff and product boundaries, including corpus rights/projection,
   live-versus-snapshot status and stateless delivery/refund handling.
2. Obtain owner approval for a bounded Vercel Preview build. Do not push merely to
   obtain CI: Git-backed pushes can trigger builds and require that authorization.
3. Inspect the built/served output for private material and exact schema/route behavior;
   source-level and injected-response checks are not a substitute for bundle inspection.
4. Review a separate activation change (withheld declarations **and** environment gate).
   Use a tightly scoped Preview/synthetic or test-network canary, no unsanctioned mainnet
   payment. Prove the real provider/ledger boundaries and cleanup.
5. Measure worst-case input latency, database/provider cost, abuse load and any extra
   operational charges. Add explicit production rate controls if the existing gateway
   and distributed capacity limits do not meet the measured budget.
6. Agree a bounded delivery-loss/refund procedure. Capacity limits do not provide
   guaranteed response recovery or a complete billing support policy.
7. Only with separate authorization: merge, Production build, paid canaries and Bazaar
   publication. Record observed availability separately from implemented capability.

The implementation adds APIs, not ten substantial articles, new evidence inspections,
new canonical releases or evidence of customer demand. It does not change the 4,000
canonical-route publication ledger.
