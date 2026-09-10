# Proposed x402 price ladder

Companion to [`unit-costs.md`](unit-costs.md) and [`experiment-plan.md`](experiment-plan.md). Nothing here is applied. The change is supplied as an unapplied diff, [`price-ladder.diff`](price-ladder.diff).

## First: the collisions in the brief are already fixed

The brief asks for a collision-free ladder on the premise that several offers share amounts. **They no longer do.** [VERIFIED] PR #427 (`9d1cbf9b`, merged 2026-09-09) gave all nineteen payable offers distinct settled amounts, and `assertDistinctPayableAmounts()` in `lib/x402/offers.ts` throws at module load if that is ever broken. Current state: **19 distinct amounts of 19.**

So this is not a collision repair. It addresses what #427 traded away to ship the fix fast: **eleven of the eighteen gaps in the current ladder are 1–4 base units** ($0.000001–$0.000004). Those amounts are distinct on-chain but indistinguishable to anyone reading an invoice, and they are brittle — the facilitator fee alone is $0.001, **a thousand times the smallest current gap**. [SOURCED]

## The spacing rule

> **Every pair of payable amounts differs by at least 2,000 base units ($0.002) — twice the facilitator fee.**

The fee is the largest per-settlement perturbation we know of, so requiring twice it means no fee-scale error can alias one product onto another. A rule with a reason, rather than a round number.

| | current | proposed |
|---|--:|--:|
| distinct amounts | 19 / 19 | 19 / 19 |
| smallest gap | 1 base unit ($0.000001) | 2,000 base units ($0.002) |
| gaps below the rule | 11 of 18 | **0 of 18** |
| amounts a human reads as distinct | 11 of 19 | **19 of 19** |

## Two constraints that shaped this more than cost did

**1. Two prices are derived, not chosen.** `context-budget-ladder` and `evidence-retention-matrix` publish their price basis in their own offer descriptions — "five $0.001 compilations" and "five $0.01 evaluations". Those are checkable claims, and they are the best-designed thing in the current ladder. They constrain the result: raising `context-compression` to $0.002 propagates into `context-budget-ladder`, whose derived price of $0.010 then lands exactly on `deep-context-evaluation`. It is priced at $0.012 instead, with the basis restated to "five $0.002 compilations plus the comparison table and receipt" — true, and it accounts for the extra $0.002. `evidence-retention-matrix` is **held at $0.05**, which keeps its stated basis exactly correct. [VERIFIED]

**2. Withheld offers still share amounts, on purpose.** Ten unpublished micro offers sit at `5000` and `10000`; the ledger indexes only payable offers, so this costs nothing until one is published, and the guard throws if one ever is without a free amount. This ladder avoids `5000` so it does not create a *new* landmine. `10000` stays taken by `deep-context-evaluation`, which is the pre-existing situation and not made worse here. [VERIFIED]

## The ladder

| endpoint | now | proposed | change | rationale |
|---|--:|--:|--:|---|
| `context-compression` | $0.001000 | **$0.002000** | 2.00× | **The only cost-forced change.** At $0.001 the facilitator fee is 100% of revenue — 0% gross margin at any volume. Already approved. |
| `revision-lineage-check` | $0.005004 | **$0.006000** | 1.20× | Off the collapsed $0.005 cluster. `6000` rather than `5000` to avoid a new clash with three withheld offers. |
| `unit-uncertainty-conversion` | $0.005008 | **$0.008000** | 1.60× | Off the $0.005 cluster onto its own rung. |
| `deep-context-evaluation` | $0.010000 | **$0.010000** | — | **Held.** 4 external settlements — half of all products with any demand. Not touched. |
| `context-budget-ladder` | $0.005000 | **$0.012000** | 2.40× | Derived: five $0.002 compilations plus the comparison table. Runs 5 compiler passes; was priced level with a one-shot check. |
| `divine-name-disambiguation` | $0.005011 | **$0.014000** | 2.79× | Corpus-backed against a pinned registry; more work than a scalar check. |
| `citation-binding-check` | $0.005003 | **$0.016000** | 3.20× | Scales to 20 bindings per call. |
| `audit-export-normalizer` | $0.010002 | **$0.018000** | 1.80× | Scales to 100 events — the widest input range in the micro set. |
| `celestial-position-snapshot` | $0.010001 | **$0.020000** | 2.00× | Ephemeris-backed; its own rung above the pure-arithmetic checks. |
| `book-section-the-imagined-life` | $0.005001 | **$0.025000** | 5.00× | Delivers 13 KB of licensed prose. $0.005 was never a considered price — it was the microproduct default. |
| `book-section-the-volcanic-engine` | $0.005002 | **$0.030000** | 6.00× | Delivers 25 KB, nearly twice its sibling, and was priced 1 base unit from it. |
| `evidence-retention-matrix` | $0.050000 | **$0.050000** | — | **Held at $0.05.** Derived as five $0.01 evaluations; holding keeps that published claim true. |
| `celestial-chart-evidence` | $0.050001 | **$0.060000** | 1.20× | Full chart evidence pack, 14 KB response. |
| `celestial-vimshottari-timing` | $0.100001 | **$0.120000** | 1.20× | Multi-period timing computation. |
| `mps-autonomous-audit` | $0.100000 | **$0.250000** | 2.50× | **Fixes a cost inversion.** One of only two offers with real marginal cost (~$0.04–$0.06/call), it was priced *below* five zero-marginal-cost deterministic offers. |
| `governed-context-verification-pack` | $0.500000 | **$0.500000** | — | **Held at $0.50.** See the asymmetry note. |
| `research-intake-evidence-pack` | $1.000000 | **$1.000000** | — | **Held at $1.00.** Model-backed, 67–86% margin, no demand signal to act on. |
| `book-edition-the-imagined-life` | $2.990000 | **$3.000000** | 1.00× | 337 KB delivered. $2.99 → $3.00 is cosmetic; it buys the spacing rule. |
| `book-edition-the-volcanic-engine` | $2.990001 | **$3.500000** | 1.17× | 428 KB, 27% more than its sibling, and was priced 1 base unit from it. |

**Four prices are unchanged**, deliberately: the two with observed demand keep the price at which that demand was observed, and the two with a published derivation or no signal are held.

## What the comparator says about this ladder

A second seller in the same ecosystem prices at $0.001, $0.005, $0.02, $0.045–$0.50 and $0.20, on 200 settlements and $7.08 lifetime. [SOURCED — their public dashboard, supplied 2026-09-10] Three consequences for this proposal:

**It corroborates the spacing rule.** Their ladder is round numbers, widely spaced, no micro-offsets. The smallest gap between their distinct prices is $0.004 — twice what this proposal's rule requires. Nobody in this market prices at `5003` and `5004`.

**It supports raising, and puts a ceiling on how far.** Their top tier ($0.20–$0.50) carries an estimated 87–88% of their revenue, which is the clearest evidence available that this buyer population pays well above $0.01. That makes `mps-autonomous-audit` at $0.25 and `governed-context-verification-pack` held at $0.50 look reasonable rather than optimistic. It also means **nothing above $0.50 has been demonstrated to sell here.** `research-intake-evidence-pack` at $1.00 and the book editions at $3.00/$3.50 sit above anything proven in this market. The asymmetry argument still says don't cut them — but they should not be counted on.

**Their $0.005 tier holds two products at the same price** — trust scores and find alternatives — while their dashboard still attributes each settlement to an endpoint. They are reading server-side records, not recomputing from chain data. **Our spacing rule is the price we pay for a chain-recomputable ledger**, where the settled amount is the only discriminator a third party can see. That is a deliberate trade for verifiability, not a constraint the market imposes; it is worth knowing we are the only ones paying it.

## The asymmetry, and why nothing is cut

Seventeen of nineteen offers have never recorded a sale at any price. For those, expected revenue is `q(p) × p` with every measured `q` equal to zero — and `0 × $0.20 = 0 × $0.50`. **There is no optimum to find.** [VERIFIED]

The degeneracy is not symmetric:

- **Raising a never-sold price forgoes nothing observable.** Zero sales before, zero after.
- **Cutting one forgoes margin on sales you may yet make** at the higher price, in exchange for a demand response no instrument here is fine enough to detect.

With `q` unknown and observed `q = 0`, the risk-dominant direction is **up** — the reverse of the instinct that an unsold thing is overpriced. Every change below is an increase. Cutting only wins if the objective is *information* rather than revenue, and [`experiment-plan.md`](experiment-plan.md) shows information is not purchasable at this volume.

### Two specific moves considered

**Cut `governed-context-verification-pack` $0.50 → $0.20.** Not taken. For it to raise revenue, `q($0.20)` must exceed 2.5 × `q($0.50)`; both are zero, so *any* sale at $0.20 wins — **if price is the binding constraint**. The evidence says it is not. This offer had 19 days of exposure against a catalogue-wide base rate of 0.37 settlements/day: expected sales under the null were 1.85, observed 0, which is a p-value of about 0.16. That is not a demand signal, it is a small number. [VERIFIED] And the comparator now argues the other way outright: their top tier at **$0.20–$0.50 carries an estimated 87% of their revenue**. [SOURCED] $0.50 is not obviously above this market's ceiling — it is roughly *at* the price band that earns another seller most of their money. Cutting to $0.20 would forfeit 60% of revenue per sale to move within a band that is already demonstrably payable.

**Raise the book editions.** Taken, and it is close to free: zero sales at $2.99 and zero at $3.50 cost the same. `the-volcanic-engine` delivers 428 KB against its sibling's 337 KB — 27% more — and the two were priced **one base unit apart**, which is the clearest ordering defect in the current ladder. They go to $3.00 and $3.50. Note this buys spacing and coherence, not revenue: the expected gain is $0.00 until either sells — and at $3.00+ they sit six times above the highest price shown to sell in this ecosystem, so "until either sells" may be a long time.

## What this ladder is not

It is **not profit-maximising**, and it is not derived from cost. [`unit-costs.md`](unit-costs.md) shows compute is under 0.25% of price on every endpoint, so a 1,750× price spread rests on a cost spread of approximately zero. Cost sets a floor — $0.002, from the facilitator fee — and says nothing above it.

Everything above the floor is a judgment about willingness to pay, made from **twelve settlements, seven wallets, two products**. Read it as a coherent hypothesis with defensible internal ordering, not an optimum. The ordering claims one thing only: **within a tier, more delivered work should not cost less.** The current ladder violates that in at least three places; this one does not.

## Applying it

```bash
git apply pricing/price-ladder.diff
```

The diff touches four files — `lib/x402/offers.ts`, `micro-contracts.ts`, `micro-next-contracts.ts`, `celestial-products.ts`. It is **not sufficient on its own.** Measured, not predicted: [VERIFIED]

| | tests | failures |
|---|--:|--:|
| `origin/main` unmodified | 4,589 | 9 |
| with this diff applied | 4,589 | 82 |

The 9 baseline failures are Postgres-dependent and unrelated. The diff therefore causes **73 new failures across 18 files**, essentially all of them assertions that hard-code a price. Before this can merge, someone must:

1. Update the hard-coded amounts in the 18 affected test files (`x402-offer-catalog`, `x402-discovery`, `x402-gateway`, `x402-route`, `x402-microproducts`, `x402-celestial-products`, `x402-tiered-offer-behavior`, `x402-mps-unit-economics`, `x402-buyer-delivery-check` and others).
2. Regenerate `public/.well-known/x402-public-manifest.json`, which is derived from the catalog — the test run rewrites it automatically.
3. Decide the question this document cannot: whether the increases are wanted at all.

`supersededAmounts` entries are included for the two changed offers that have settlement history — `context-compression` (15 settlements at `1000`) and `mps-autonomous-audit` (2 at `100000`) — so the public ledger keeps attributing those payments after the change. The other repriced offers have no settlements at their current amounts, so they need none. [VERIFIED]

