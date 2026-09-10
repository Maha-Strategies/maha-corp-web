# Pricing experiment plan

Companion to [`unit-costs.md`](unit-costs.md) and [`ladder-proposal.md`](ladder-proposal.md).

## 1. Our demand record, in full

Every external settlement ever recorded, from `content/x402/settlement-ledger.json` (Base Mainnet USDC Transfer logs, blocks 48360877–51065249). [VERIFIED]

| | |
|---|--:|
| external settlements, all time | **12** |
| canary settlements (ours) | 14 |
| distinct external wallets | **7** |
| largest single wallet | 5 of 12 (42%) |
| repeat wallets | 2 |
| products with any external demand | **2 of 19** |
| total external revenue, all time | **$0.048** |
| observation window | 32.6 days |

`context-compression` has 8; `deep-context-evaluation` has 4; the other seventeen have zero.

## 2. The comparator — and it reframes most of this

A second seller in the same x402 ecosystem publishes a live dashboard. Figures below are **[SOURCED]** from that dashboard as supplied by the operator on 2026-09-10; I have not independently recomputed them from chain data.

Their catalogue: trust scores ($0.005), semantic search ($0.001), endpoint history ($0.02), find alternatives ($0.005), endpoint watch ($0.20), bulk trust scores ($0.045–$0.50). Their dashboard shows only the five most recent settlements, so the product mix behind the other 195 is not visible.

| | competitor | Maha | ratio |
|---|--:|--:|--:|
| settled payments | **200** | 12 | **16.7×** |
| lifetime revenue | **$7.0796** | $0.048 | **147×** |
| distinct payers | 33 | 7 | 4.7× |
| recurring payers | 18 | 2 | 9.0× |
| recurring rate | **55%** | 29% | 1.9× |
| revenue / settlement | **$0.0354** | $0.0040 | **8.8×** |
| revenue / payer | $0.2145 | $0.0069 | 31× |
| products in catalogue | **6** | 19 | 0.3× |
| revenue / product | $1.18 | $0.0025 | **467×** |

### Three things this settles

**a. The market does pay above $0.01.** Their mean settlement is $0.0354 — 8.8× ours. 200 settlements at their visible $0.005 tier would total $1.00, but the actual total is $7.08. **Seven-eighths of their revenue comes from purchases we cannot see, and those purchases must be at the top of their ladder.** [VERIFIED arithmetic on [SOURCED] figures]

| if the total is carried by | count | share of settlements | share of revenue |
|---|--:|--:|--:|
| endpoint watch @ $0.20 | ~31 | 16% | 88% |
| bulk trust @ $0.50 | ~12 | 6% | 87% |

That decomposition is **[UNVERIFIED]** — an inference from the total, not an observation of the 195 hidden settlements. But every solution has the same shape: **a small number of expensive purchases carries almost all the revenue.** This is the strongest available evidence against the idea that this buyer population only tolerates sub-cent prices — the assumption our own $0.001–$0.01 concentration has been quietly encoding.

**b. Their catalogue is a third the size and earns 467× more per product.** Nineteen products is not an asset. Six well-differentiated ones outperform it by every measure here.

**c. Their products compound; ours do not.** All six are *meta-products about the x402 ecosystem itself* — trust, search, history, watch, alternatives. **Every new endpoint published by anyone increases demand for all six.** That is a genuine network effect. Our nineteen are one-shot utilities: a celestial calculation is worth no more when the Bazaar doubles in size. Their 55% recurring rate against our 29% is the visible consequence, and `endpoint watch` at $0.20 is recurring *by construction* — monitoring is a subscription shape, not a request shape.

> **The most valuable thing in this comparison is not a price. It is that they sell infrastructure for the marketplace they are in, and we sell things that happen to be sold in it.**

## 3. Can we run a price A/B test?

Not at our volume. At theirs, yes. That gap is the finding.

Two-sample Poisson, α = 0.05 two-sided, 80% power, 50/50 split. Smallest detectable change in demand: [VERIFIED]

| n (total settlements) | detects a change of |
|---|--:|
| 8 — `context-compression` alone | **100%** |
| 12 — all Maha external, pooled | **96%** |
| 100 | **48%** |
| 200 — competitor lifetime | **36%** |
| 500 | **23%** |

| to detect | settlements needed |
|---|--:|
| a 50% change | 91 |
| a 35% change | 209 |
| a 25% change | 437 |
| a 10% change | 2,981 |

At n = 12 only a **96% collapse** is detectable; on `context-compression` alone, only total extinction. And 12 overstates it — one wallet supplied 5 of the 12, so there are **7 independent deciders**, not 12.

At n = 200 a **36% effect** is detectable, which is inside the range a real price change produces. **The competitor demonstrates that n = 200 is reachable in this ecosystem.** That converts "wait for more data" from an excuse into a plan with a known destination.

## 4. Price versus discovery

The brief asks whether zero demand reflects price or listing. For our catalogue it is listing, and the comparator strengthens rather than weakens that reading. [VERIFIED]

Exposure inside the ledger window, from each offer's first appearance in the catalogue (`git log -S` on the offer id):

| endpoint | price | days exposed | expected under equal-rate null | actual |
|---|--:|--:|--:|--:|
| `context-compression` | $0.001 | 32 | 3.12 | 8 |
| `deep-context-evaluation` | $0.010 | 29 | 2.83 | 4 |
| `mps-autonomous-audit` | $0.100 | 29 | 2.83 | 0 |
| `governed-context-verification-pack` | $0.500 | 19 | 1.85 | 0 |
| 7 offers added 2026-09-06 | — | 2 | 0.20 | 0 |
| 8 offers added 2026-09-09 | — | 0 | 0.00 | 0 |

**Demand is rank-ordered by exposure, not price.** The two products that sold are the two oldest listings. Everything listed ≤19 days sold nothing across a 598× price range — a uniformly zero response across two orders of magnitude of price is what you see when price is not the variable in play.

Two facts make the zeros uninformative rather than negative: [VERIFIED]

1. **Eight offers had zero exposure inside the window** — added 2026-09-09, after the ledger's last observed block. Their zero is not a measurement.
2. **Eight offers were unreachable by crawlers until 2026-09-09**, returning HTTP 400 to an unpaid probe instead of 402, so no discovery crawler ever saw a price to reject. They have had **one day** of genuine discoverability.

`mps-autonomous-audit` looks like a real negative — 29 days, zero sales — but it was not declared on the Bazaar until that same PR, so its catalogue presence never amounted to discoverability. That leaves exactly **one** offer with real exposure and a genuine zero: `governed-context-verification-pack`, 19 days at $0.50, expected 1.85 sales, observed 0. p ≈ 0.16. Not evidence.

And the comparator now supplies what our own data could not: **a $0.20 product and a $0.045–$0.50 product sell in this ecosystem.** Our expensive products are not failing because the price ceiling is $0.01.

## 5. What to do

### Order of operations

| | action | why now |
|---|---|---|
| 1 | **Ship the exposure fix and let it run.** | 8 offers have had one day of discoverability; 11 of 19 have had ≤4 days. Nothing else can be read until this is no longer true. |
| 2 | **Record model token usage.** | Margin on the two model-backed offers swings 36%→60% on an unmeasured constant. One line per route. |
| 3 | **Build one compounding product.** | The single largest gap against the comparator, and no price change substitutes for it. |
| 4 | **Apply the price ladder.** | Cheap, but it is the least valuable of the four. |
| 5 | **Re-read demand at n ≈ 200.** | Set the trigger on the event count, not the calendar. |

### On building something that compounds

This is a product recommendation, not a pricing one, and it is the one with real money attached. The comparator earns $1.18 per product against our $0.0025 while running a third the catalogue, and the difference is not price or marketing — it is that their products get more valuable as the ecosystem grows and ours do not.

We already hold the raw material: a chain-recomputable settlement ledger, a discovery crawler probe across the whole catalogue, and conformance dimensions. Those are the inputs to exactly the class of product the comparator sells. **We have been using them as internal plumbing rather than as inventory.**

### On the value of exposure versus repricing

At the pooled observed rate of 0.098 settlements per offer-listed-day, giving all nineteen offers 30 days of genuine discoverability is worth roughly: [VERIFIED arithmetic; the equal-rate null is [UNVERIFIED] and optimistic for the $3 products]

| scenario | 30-day revenue |
|---|--:|
| new offers sell at the pooled rate | $22.96 |
| at a quarter of it | $5.74 |
| at a tenth of it | $2.30 |

Against that, doubling `context-compression` at observed volume adds **$0.0074** over the same 30 days, and every other repricing adds exactly $0.00, because `0 × p = 0`. **Exposure is worth two to three orders of magnitude more than any price change on the table.**

### The one deadline

The facilitator fee begins at 1,000 transactions. [SOURCED] We are at 26 total after 32.6 days; the competitor is at 200. It is a step change, not a ramp, and it takes `context-compression` to a 0% margin the day it lands. The $0.001 → $0.002 step-up should be in place before then — the one price decision here that needs no demand curve.

## Method

Sample sizes use the variance-stabilising √ transform for Poisson counts: with `Var(√X) ≈ 1/4`, detecting a rate ratio `R` needs `λ₀T ≥ (z_α/2 + z_β)² / (2(√R − 1)²)` expected events per arm; at α = 0.05 two-sided and 80% power, `(z_α/2 + z_β)² = 7.85`. This assumes independent arrivals — which the wallet concentration on both sides already violates, so real requirements are **larger** than stated, not smaller.

Competitor figures are a single seller's self-published dashboard at one moment. They are not audited, the window is unknown, and the product mix behind 195 of the 200 settlements is not disclosed. Treat every comparison here as directional.

