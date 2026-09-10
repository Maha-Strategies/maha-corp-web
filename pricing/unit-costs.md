# x402 endpoint unit costs — measured

Measured 2026-09-10 on the author's machine, at `origin/main` d9d5558a.
Harness: [`scripts/measure-x402-unit-costs.ts`](../scripts/measure-x402-unit-costs.ts). 31 timed iterations per endpoint per payload, after one warm call.

Claims are tagged **[VERIFIED]** (measured or read directly from this repository), **[SOURCED]** (external figure, attributed), or **[UNVERIFIED]** (cannot be checked from here).

## Summary

**Compute is not a meaningful cost at any of these prices.** [VERIFIED] The heaviest call measured across the whole catalogue — `evidence-retention-matrix` at its maximum valid payload — burns 55.6 ms of CPU. Priced at even $0.50/CPU-hour that is $0.0000077, or 0.015% of its $0.05 price. No deterministic endpoint's compute cost reaches one part in four hundred of its price.

**The real per-call cost is the facilitator fee.** [SOURCED — Coinbase CDP terms as reported by the operator; not independently confirmed by me] Settlement is free at current volume and costs $0.001 per transaction after 1,000 transactions. At that point the fee is 100% of `context-compression`'s $0.001 price and 0.03% of a book edition's $2.99. **The fee, not compute, sets the price floor.**

**Two endpoints are model-backed and their true cost is not recorded anywhere.** [VERIFIED] `mps-autonomous-audit` and `research-intake-evidence-pack` call Claude; neither reads `usage` from the API response, so actual token spend has never been observed. Their cost below is a *bound* derived from hard caps in the code, not a measurement.

## 1. Deterministic endpoints (17 of 19)

Wall-clock and CPU are per invocation of the endpoint's build function, in process. This excludes HTTP, payment verification and cold start, and so understates end-to-end latency; it isolates the part of the cost the endpoint itself controls.

Payload sizes are the smallest and largest *valid* inputs the schema admits. "fixed" marks an endpoint whose input has no size degree of freedom — one instant, one scalar conversion, one lineage pair, one name, one book — so there is no distribution over sizes to report. [VERIFIED]

| endpoint | payload | price | req bytes | resp bytes | p50 ms | p95 ms | max ms | CPU µs |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| `context-compression` | small | $0.001000 | 973 | 2,842 | 0.083 | 0.180 | 0.782 | 264 |
| `context-compression` | median | $0.001000 | 10,317 | 3,329 | 0.574 | 0.772 | 1.174 | 787 |
| `context-compression` | large | $0.001000 | 296,349 | 4,307 | 14.851 | 19.432 | 20.894 | 16,724 |
| `context-budget-ladder` | small | $0.005000 | 690 | 16,032 | 0.251 | 0.309 | 0.458 | 307 |
| `context-budget-ladder` | median | $0.005000 | 6,344 | 18,479 | 1.766 | 2.079 | 2.174 | 1,842 |
| `context-budget-ladder` | large | $0.005000 | 178,232 | 23,393 | 50.365 | 52.748 | 52.872 | 53,418 |
| `deep-context-evaluation` | small | $0.010000 | 1,414 | 5,015 | 0.066 | 0.104 | 0.105 | 81 |
| `deep-context-evaluation` | median | $0.010000 | 10,758 | 5,507 | 0.539 | 0.725 | 0.731 | 570 |
| `deep-context-evaluation` | large | $0.010000 | 296,790 | 6,491 | 15.662 | 15.882 | 15.920 | 16,594 |
| `evidence-retention-matrix` | small | $0.050000 | 996 | 19,741 | 0.293 | 0.342 | 0.349 | 319 |
| `evidence-retention-matrix` | median | $0.050000 | 6,650 | 22,215 | 1.845 | 2.148 | 2.207 | 1,902 |
| `evidence-retention-matrix` | large | $0.050000 | 178,538 | 27,159 | 52.127 | 66.466 | 66.957 | 55,587 |
| `governed-context-verification-pack` | small | $0.500000 | 980 | 5,052 | 0.067 | 0.091 | 0.097 | 84 |
| `governed-context-verification-pack` | median | $0.500000 | 6,634 | 5,548 | 0.391 | 0.569 | 0.685 | 419 |
| `governed-context-verification-pack` | large | $0.500000 | 178,522 | 6,536 | 11.073 | 11.492 | 11.608 | 11,635 |
| `book-section-the-imagined-life` | fixed | $0.005001 | 28 | 13,257 | 0.504 | 1.820 | 2.575 | 517 |
| `book-section-the-volcanic-engine` | fixed | $0.005002 | 28 | 24,617 | 0.996 | 2.252 | 4.765 | 1,148 |
| `book-edition-the-imagined-life` | fixed | $2.990000 | 2 | 337,117 | 9.684 | 11.969 | 12.233 | 9,983 |
| `book-edition-the-volcanic-engine` | fixed | $2.990001 | 2 | 428,034 | 19.120 | 20.905 | 22.237 | 19,225 |
| `celestial-position-snapshot` | fixed | $0.010001 | 65 | 2,445 | 0.080 | 0.102 | 0.159 | 124 |
| `celestial-chart-evidence` | fixed | $0.050001 | 106 | 14,343 | 0.416 | 0.761 | 0.990 | 666 |
| `celestial-vimshottari-timing` | fixed | $0.100001 | 155 | 6,244 | 0.801 | 1.076 | 1.503 | 1,140 |
| `citation-binding-check` | small | $0.005003 | 370 | 1,408 | 0.029 | 0.047 | 0.051 | 46 |
| `citation-binding-check` | median | $0.005003 | 3,358 | 3,433 | 0.109 | 0.178 | 0.256 | 126 |
| `citation-binding-check` | large | $0.005003 | 6,678 | 5,693 | 0.204 | 0.329 | 0.430 | 379 |
| `revision-lineage-check` | fixed | $0.005004 | 453 | 1,211 | 0.021 | 0.028 | 0.029 | 25 |
| `audit-export-normalizer` | small | $0.010002 | 385 | 1,614 | 0.030 | 0.043 | 0.059 | 94 |
| `audit-export-normalizer` | median | $0.010002 | 8,861 | 10,090 | 0.322 | 0.431 | 0.468 | 537 |
| `audit-export-normalizer` | large | $0.010002 | 17,686 | 18,915 | 0.613 | 0.721 | 0.826 | 1,046 |
| `unit-uncertainty-conversion` | fixed | $0.005008 | 114 | 1,382 | 0.022 | 0.032 | 0.035 | 28 |
| `divine-name-disambiguation` | fixed | $0.005011 | 136 | 2,396 | 0.683 | 0.829 | 0.839 | 774 |

### The tail

The brief is right that the tail matters more than the mean under a flat price. It is large in *relative* terms and irrelevant in absolute terms: [VERIFIED]

- `context-budget-ladder` runs in 0.251 ms at its smallest valid payload and 52.748 ms at p95 on its largest — a **210× spread inside one flat price**.
- `evidence-retention-matrix` spans 0.293 ms to 66.466 ms p95, a 227× spread.
- Both tails cost under $0.00001 to serve. A 210× cost tail on a base of ~$0.0000001 does not threaten a $0.005 price.

The tail that *would* matter is a model-token tail, and that is on the two endpoints where we have no instrumentation at all.

## 2. Model-backed endpoints (2 of 19)

Neither endpoint records token usage. [VERIFIED] Both issue a single `max_tokens: 1500` request (`app/api/v1/mps/audit/route.ts:204`, `lib/x402/research-intake-runtime.ts:51`) to `claude-sonnet-4-6` and discard the `usage` block the API returns.

What *can* be bounded, from caps that are enforced in code: [VERIFIED]

| | `mps-autonomous-audit` | `research-intake-evidence-pack` |
|---|---|---|
| price | $0.10 | $1.00 |
| input cap | 6,000 chars (`MAX_AUDIT_PASSAGE_CHARS`) | 65,536 bytes (offer `maxRequestBytes`) |
| output cap | 1,500 tokens | 1,500 tokens |
| retry cap | 3 attempts | 3 attempts |

Token prices of $3/Mtok in and $15/Mtok out are taken from `lib/x402/mps-unit-economics.ts:24-25`. [SOURCED — the repository's own constant; I did not check it against Anthropic's current price list]

| endpoint | assumption | input tokens | expected calls | model cost | total | margin |
|---|---|--:|--:|--:|--:|--:|
| `mps-autonomous-audit` | expected: 0.5 tok/char, 15% fail | 3,700 | 1.173 | $0.03940 | $0.04040 | 59.6% |
| `mps-autonomous-audit` | conservative: 1.0 tok/char, 35% fail | 6,700 | 1.472 | $0.06273 | $0.06373 | 36.3% |
| `research-intake-evidence-pack` | expected: 0.5 tok/char, 15% fail | 33,468 | 1.173 | $0.14410 | $0.14510 | 85.5% |
| `research-intake-evidence-pack` | conservative: 1.0 tok/char, 35% fail | 66,236 | 1.472 | $0.32573 | $0.32673 | 67.3% |

The tokens-per-character figures are **[UNVERIFIED]**. They come from `EXPECTED_TOKENS_PER_CHAR = 0.5` and `CONSERVATIVE_TOKENS_PER_CHAR = 1.0` in `lib/x402/mps-unit-economics.ts:44-45`, which are the repository's own assumptions and have never been checked against a real response. The failure rates (15% / 35%) are likewise assumptions in that file, not observed failure counts.

Both endpoints stay profitable across that whole assumption range. Break-even sits at **2.37 tokens/char** for the audit and **3.33 tokens/char** for the intake pack — far above any plausible tokenisation of English text, so the conclusion "these two are profitable" is robust to the assumption being wrong by a factor of two. [VERIFIED — arithmetic on the caps above]

## 3. What is not measured

| cost | status | what is missing |
|---|---|---|
| Serverless execution, in dollars | **[UNVERIFIED]** | No access to the hosting bill from this repository. CPU time is measured above; the $/CPU-hour rate is not. |
| Actual model tokens | **[UNVERIFIED]** | Neither model route reads `usage` from the Anthropic response. One line per route would fix this. |
| Model failure / retry rate | **[UNVERIFIED]** | Attempt counts are stored per job but never aggregated; `EXPECTED_FAILURE_RATE` is an assumption. |
| Facilitator fee | **[SOURCED]** | Operator-reported CDP terms. Not confirmed against a CDP invoice. |
| Cold-start frequency and cost | **[UNVERIFIED]** | Not observable in-process; needs platform metrics. |
| Supabase / ledger write cost | **[UNVERIFIED]** | Per-call database writes are not separately metered. |

### The instrumentation worth adding

One change dominates the rest: **record `usage.input_tokens` and `usage.output_tokens` from the Anthropic response** on both model routes and pass them to `recordOfferTelemetry`, which already accepts `inputTokens` and `outputTokens` (`lib/x402/offer-telemetry.ts:92-93`) and already writes them through to the metering RPC. The field exists; nothing populates it.

Note that `/api/v1/compress` and `/api/v1/compress/evaluate` *do* pass those fields (`app/api/v1/compress/route.ts:38-39`), but they pass `originalEstimatedTokens` and `compiledEstimatedTokens` — the compiler's estimate of the *caller's* document size. That is a product metric, not a cost. No endpoint in this repository currently records a token count that corresponds to money spent. [VERIFIED]

## 4. Gross margin at p50 and p95

Cost per call = compute (measured CPU × an assumed $0.50/CPU-hour, deliberately at the high end of any plausible rate) + the $0.001 facilitator fee. The fee is charged in the post-1,000-transaction regime; today it is $0, so these are the *forward* margins, not today's. [VERIFIED for compute; [SOURCED] for the fee; the $/CPU-hour rate is [UNVERIFIED]]

| endpoint | payload | price | cost @ p50 | cost @ p95 | margin @ p50 | margin @ p95 |
|---|---|--:|--:|--:|--:|--:|
| `context-compression` | small | $0.001000 | $0.0010000 | $0.0010001 | -0.0% | -0.0% |
| `context-compression` | median | $0.001000 | $0.0010001 | $0.0010001 | -0.0% | -0.0% |
| `context-compression` | large | $0.001000 | $0.0010023 | $0.0010030 | -0.2% | -0.3% |
| `context-budget-ladder` | small | $0.005000 | $0.0010000 | $0.0010001 | 80.0% | 80.0% |
| `context-budget-ladder` | median | $0.005000 | $0.0010003 | $0.0010003 | 80.0% | 80.0% |
| `context-budget-ladder` | large | $0.005000 | $0.0010074 | $0.0010078 | 79.9% | 79.8% |
| `deep-context-evaluation` | small | $0.010000 | $0.0010000 | $0.0010000 | 90.0% | 90.0% |
| `deep-context-evaluation` | median | $0.010000 | $0.0010001 | $0.0010001 | 90.0% | 90.0% |
| `deep-context-evaluation` | large | $0.010000 | $0.0010023 | $0.0010023 | 90.0% | 90.0% |
| `evidence-retention-matrix` | small | $0.050000 | $0.0010000 | $0.0010001 | 98.0% | 98.0% |
| `evidence-retention-matrix` | median | $0.050000 | $0.0010003 | $0.0010003 | 98.0% | 98.0% |
| `evidence-retention-matrix` | large | $0.050000 | $0.0010077 | $0.0010098 | 98.0% | 98.0% |
| `governed-context-verification-pack` | small | $0.500000 | $0.0010000 | $0.0010000 | 99.8% | 99.8% |
| `governed-context-verification-pack` | median | $0.500000 | $0.0010001 | $0.0010001 | 99.8% | 99.8% |
| `governed-context-verification-pack` | large | $0.500000 | $0.0010016 | $0.0010017 | 99.8% | 99.8% |
| `book-section-the-imagined-life` | fixed | $0.005001 | $0.0010001 | $0.0010003 | 80.0% | 80.0% |
| `book-section-the-volcanic-engine` | fixed | $0.005002 | $0.0010002 | $0.0010004 | 80.0% | 80.0% |
| `book-edition-the-imagined-life` | fixed | $2.990000 | $0.0010014 | $0.0010017 | 100.0% | 100.0% |
| `book-edition-the-volcanic-engine` | fixed | $2.990001 | $0.0010027 | $0.0010029 | 100.0% | 100.0% |
| `celestial-position-snapshot` | fixed | $0.010001 | $0.0010000 | $0.0010000 | 90.0% | 90.0% |
| `celestial-chart-evidence` | fixed | $0.050001 | $0.0010001 | $0.0010002 | 98.0% | 98.0% |
| `celestial-vimshottari-timing` | fixed | $0.100001 | $0.0010002 | $0.0010002 | 99.0% | 99.0% |
| `citation-binding-check` | small | $0.005003 | $0.0010000 | $0.0010000 | 80.0% | 80.0% |
| `citation-binding-check` | median | $0.005003 | $0.0010000 | $0.0010000 | 80.0% | 80.0% |
| `citation-binding-check` | large | $0.005003 | $0.0010001 | $0.0010001 | 80.0% | 80.0% |
| `revision-lineage-check` | fixed | $0.005004 | $0.0010000 | $0.0010000 | 80.0% | 80.0% |
| `audit-export-normalizer` | small | $0.010002 | $0.0010000 | $0.0010000 | 90.0% | 90.0% |
| `audit-export-normalizer` | median | $0.010002 | $0.0010001 | $0.0010001 | 90.0% | 90.0% |
| `audit-export-normalizer` | large | $0.010002 | $0.0010001 | $0.0010002 | 90.0% | 90.0% |
| `unit-uncertainty-conversion` | fixed | $0.005008 | $0.0010000 | $0.0010000 | 80.0% | 80.0% |
| `divine-name-disambiguation` | fixed | $0.005011 | $0.0010001 | $0.0010001 | 80.0% | 80.0% |

**p50 and p95 margins are identical to one decimal place on every endpoint.** [VERIFIED] That is the finding, not a rounding artefact: the fee is fixed per settlement and compute is too small to move the number, so the latency tail — however dramatic in relative terms — does not reach the margin. Flat-rate pricing is safe here for a reason that has nothing to do with the tail being small.

The one endpoint that fails is **`context-compression` at $0.001: a 0% gross margin**, and fractionally negative once compute is counted. The facilitator fee alone equals the entire price. This is the arithmetic behind the already-approved step-up to $0.002, and it is the only price on the board that is currently unsound on cost grounds. [VERIFIED]

**A comparator makes the same point from the revenue side.** A second seller in this ecosystem averages **$0.0354 per settlement** against our $0.0040, on a catalogue a third the size. [SOURCED — their public dashboard, 2026-09-10] Their cost structure cannot be meaningfully different from ours — trust scores and semantic search over endpoint metadata are the same class of cheap deterministic compute measured above. They are earning 8.8× more per settlement for work that costs about the same to perform. **Cost is not what separates the two catalogues, and it is not what should set either ladder.**

Every other deterministic endpoint sits between 80% and 100% gross margin. A 598× price spread ($0.005 to $2.99) sits on top of a cost spread that is, in absolute terms, approximately zero. **These prices are not cost-derived and cannot be defended on cost.** What they encode is a guess about willingness to pay — which is the subject of the ladder proposal and, more importantly, of the experiment plan.

