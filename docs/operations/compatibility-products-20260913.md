# Two compatibility products: local review package

Status: implemented locally, not deployed, not enabled for payment, not indexed.
Worktree: `/private/tmp/maha-compatibility-products`; branch `codex/compatibility-products`.
Existing main-workspace page and settlement edits were not modified.

Verification:627 x402 tests passed, targeted ESLint passed, Next route type
generation and TypeScript passed. Local HTTP checks returned200 for the free
explanation page, rule-set endpoint and both draft contracts. Production-denial
tests confirm neither offer reaches settlement. No production build/deployment
or paid acceptance test was performed. Local preview was stopped after checks.

The original23 launch entries were independently rechecked in Bazaar at
2026-09-13T08:02:53Z: all23 had the expected prices and revised descriptions.

## Commercial and release decisions

These would add two to the prior23-offer launch cohort, making25 in that cohort.
That is not the entire company catalogue: the released catalogue currently has29
payable offers, including products outside that launch. Adding two would make31.
Neither new offer is included in any previous spent indexing authorization.

| Draft offer | User target | Proposed exact launch price | Bound |
|---|---:|---:|---|
| Celestial Result Compatibility | $0.005 | $0.007 /7000USDC base units | one pair of declarations |
| Evidence-Frame Compatibility | $0.01 | $0.0105 /10500base units | one to ten claim-evidence pairs |

Both exact prices await owner approval. They do not collide with any current or
explicitly reserved superseded amount in the released catalogue. $0.01 already
belongs to deep-context-evaluation; $0.005 also has historical use, even though
the current catalogue does not retain every older amount. Do not reuse it on
the assumption that absence from the current table means absence from history.

Keep distinct prices for this release. Shared prices should be a separate
attribution migration: join verified settlement transaction/log identity to a
trusted server record carrying offerId, resource, schema/rule version and amount;
retain chain-only ambiguous transfers as unattributed. An amount alone cannot
prove a shared-price product identity. Do not silently weaken the existing gate.

The provisional indexing cost for these two alone would be $0.0175, not approved
spending. No key was accessed, no payment made, and no old workflow re-enabled.

## Rules that need review before publication

Celestial rule set: `maha-celestial-compatibility/0.1-draft`.
Supported comparison profile: body/node/house-cusp kind; explicit target; Julian
day and timescale; geocentric/topocentric origin; ecliptic/equatorial frame and
epoch; precession/nutation label; zodiac and pinned ayanamsa definition;
apparent/geometric applicability; mean/true node and named house system.
Topocentric results and house cusps require complete observer coordinates,
datum, latitude type and height reference. Current observer profile is WGS84,
geodetic latitude and ellipsoidal metre height. Other labels remain unresolved.

No UTC/TT conversion, frame transformation, ayanamsa lookup, alias resolution or
numeric-result comparison occurs. Decimal zero-padding normalization is exact
representation comparison, not a physical conversion. Every relevant field is
reported. Known differences or internal contradictions take precedence over
missing information, but missing prerequisites remain in the output. Two
equally incomplete declarations cannot pass. Matching this finite profile does
not establish that unreported settings match or that either result is correct.

Terminology references, not endorsements or imported implementations:
[IAU SOFA](https://www.iausofa.org/current-software) distinguishes precession and
nutation models; [Swiss Ephemeris interface documentation](https://www.astro.com/swisseph/swephprg.htm)
documents selectable origins, timescales, sidereal settings and node/house options.
No ephemeris library or source code was added.

Evidence rule set: `maha-evidence-frame-compatibility/0.1-draft`.
Four explicit denials match the proposed vendor/independence,
commentary/original-wording, religious-authority/history and identity/physical-
validation errors. Eight narrow allow rules cover potentially appropriate
declared relationships. They are product-policy proposals, not an external
epistemic standard or expert-reviewed certification. Review the exported tables
in `lib/x402/compatibility-products.ts` before enabling payment.

Allow rules still require declared source identity, locator, exact scope match,
claim-as-of date and evidence-publication date. Original wording additionally
requires matching editions. Historical claims additionally require an event date
inside the declared evidence coverage. A later publication can still be valid
retrospective evidence; publication availability is compared with claim-as-of,
not confused with event time. Unknown combinations/roles remain unresolved.
All missing requirements are reported even if an explicit negative rule fires.

Rules and their digest are inspectable; the outer input/result integrity receipt
binds the rule-set digest. This is not a signature, trusted timestamp, execution
proof or evidence that the submitted roles are truthful. Strict schemas reject
prose fields, private data classes, extra fields, impossible dates, over-limit
batches and malformed coordinates before settlement. Service remains stateless.

## Cost and measurement

`content/discovery/compatibility-cost-observation-v1.json` records six bounded
local workloads,1000 measured calls each after50 warmups. Includes schema
validation, calculation, output validation and receipt generation. It does not
measure cold server starts, serverless bills, network, settlement or demand.
Memory is a whole-process high-water mark, not per-call memory or cloud billing.
Maximum configured input is32KiB; output64KiB; batch ten pairs.
Final measurement2026-09-13T08:07:28Z: maximum warm p95 among tested cases was
0.286ms for celestial and0.745ms for ten-pair evidence batches. Largest measured
responses were6879 and21571bytes respectively. Benchmark artifacts bind the
implementation and workload digests. These figures vary with local load and
exclude network/payment latency; they do not establish cloud unit economics.

Illustrative margin sensitivity, not a current fee quote: with a $0.001
facilitator cost, an80% contribution target at $0.007 allows $0.0004 for all
remaining variable costs; at $0.0105 it allows $0.0011. At the $0.005 target,
that assumed fee consumes the entire20% cost allowance. Verify current fees
and actual hosting costs before claiming either margin. Fixed costs and owner
time remain outside contribution margin.

Measure successful external paid delivery, repeat use, refunds and observed
variable cost. Label own indexing payments separately. Do not infer customer
counts from wallet counts or expected revenue from search impressions.

## Publication path

1. Owner approves exact prices and evidence rules; celestial can launch first.
2. Finalize rule versions and benchmark the release build; rerun regression tests.
3. Add only these reviewed IDs to the release allowlist and synchronize all
   declarations/examples. Public explanation page remains free.
4. Merge and deploy through normal gates, then validate live challenges and
   discovery. Never count a prepared route as indexed.
5. Use a NEW exact two-offer spend authorization; exclude every previous paid
   endpoint. One settlement per offer, preserve receipts, observe index read-only.
6. Add optional links on relevant existing pages only after reconciling their
   current uncommitted edits. Suggested destinations:
   `/tools/compatibility-checks#celestial` (Check two results) and
   `/tools/compatibility-checks#evidence` (Check this evidence relationship).

The new free explanation page and rules endpoint are prepared locally. No
existing article has been paywalled and no page links were inserted over the
user's ongoing search/conversion edits. No message or promotion was sent.
