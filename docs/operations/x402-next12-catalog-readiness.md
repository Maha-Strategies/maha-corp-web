# Next twelve x402 products — local catalog expansion

## Outcome and authorization

Sixty candidate concepts are frozen with the original 24-offer snapshot. Every candidate
has a semantic adjudication. Twelve selected products are implemented locally with
strict schemas, receipts, payment handling, free example discovery and OpenAPI entries.
They remain **withheld**, as do the prior ten local microproducts. This gives 36 declared
x402 offers, not 36 live offers. The previously available offers retain their pricing
and status. No existing article or release ledger was changed.

No push, Vercel build, deployment, live payment, provider provisioning, credential change,
public registration or new canonical release was performed. This local branch builds
on `c06fd549` (the previous ten-product implementation), not on a freshly fetched main.
Reconciliation with newer shared work is required before eventual publication.

## Candidate decisions

| Disposition | Count | Meaning |
| --- | ---: | --- |
| Selected and implemented locally | 12 | Distinct bounded buyer tasks with executable examples, evidence requirements and local cost observations. |
| Deferred | 40 | Still candidates; scope, source access, differentiation or cost work remains. |
| Merge into another candidate | 4 | Generic/celestial frame transforms; solver/rank/null-space; graph/workflow traversal; paired-edition alignment/variants. |
| Extend an existing product | 3 | Policy-clause retrieval, Julian-date conversion and horizontal-coordinate conversion should not create duplicate offers without a distinct need. |
| Rights review | 1 | Landscape–deity material includes a noncommercial source representation; no paid reuse assumed. |
| Total | 60 | No candidate silently dropped or substituted. |

Utility scores describe **demonstrated local fixtures or existing public corpus lookup**,
not proven customer demand. Evidence scores distinguish independently tested procedural
rules from existing attributed corpus support. Price/cost scores use measured local
capped-workload p95, not estimates for unimplemented candidates. Unmeasured entries have
null scores and demand remains unknown for all sixty. This is a defensible shortlist,
not a claim that twelve prototypes outrank forty unmeasured implementations globally.

## Selected products

Every endpoint is `/api/v1/micro/` plus its identifier. Prices are USDC, with
`5000` base units = $0.005 and `10000` base units = $0.01.

| Product identifier | Price | Contract and limits |
| --- | ---: | --- |
| unit-uncertainty-conversion | $0.005 | Twelve fixed units in length/mass/time/temperature; exact affine conversion and uncertainty scaling. Absolute versus difference explicitly supplied. |
| covariance-uncertainty | $0.01 | Up to eight sensitivities; exact symmetry/PSD checks; exact variance and a rational enclosure of its square root. |
| exact-linear-system | $0.005 | Up to 8×8 rational system; unique, inconsistent or underdetermined; particular solution/null-space and exact residual checks. |
| bracketed-polynomial-root | $0.005 | Degree 1–8 polynomial; sign-changing bracket, positive tolerance, at most 64 iterations; no arbitrary executable function. |
| divine-name-disambiguation | $0.005 | Exact supported Tamil name spellings; source-scoped relationships, unknown state and explicit Mayon/deity/volcano ambiguity. |
| edition-verse-resolution | $0.005 | Printed pasuram to one of 46 inspected complete units in the pinned Project Madurai/Hart atlas; no numbering-system conversion. |
| reception-lineage-retrieval | $0.01 | One existing attributed reception comparison; exact locators and separated evidence frames. A topic requiring an NC source is refused in full. |
| policy-version-comparison | $0.01 | Up to 40 clauses per version; exact additions/removals/text/scope changes and declared order checks, not legal effect. |
| control-evidence-gaps | $0.01 | Up to 40 requirements/80 evidence descriptors; exact policy, content revision, scope and accepted-status matching. |
| mcp-contract-compatibility | $0.005 | Up to 30 tools per snapshot; protocol 2025-06-18, transport, names and exact input/output schema digests. No network exercise or general schema-subtyping claim. |
| tool-permission-diff | $0.005 | Up to 50 explicit allow-only entries per set; additions/removals/wildcard additions. No IAM inheritance or effective-permission evaluation. |
| publication-bundle-consistency | $0.01 | 2–8 declared views; all article/registry/API kinds required for a pass; exact URL, revision, release, source-set and status matching. |

The shared 32 KiB request limit may bind before an array's item limit. Decimal inputs
are bounded strings (12 integer and six fractional digits), with rational intermediates
capped at 4,096 bits. Results are limited to 64 KiB. Limits fail before settlement.

## Foundations, provenance and rights

- NIST SP 811 Appendix B, B.3: fixed conversion factors and scale interpretation.
  <https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors>
- NIST combined uncertainty, equation (6): sensitivity/covariance propagation is
  first-order, not empirical validation of input covariance.
  <https://physics.nist.gov/cuu/Uncertainty/combination.html>
- DLMF §3.2: linear systems and elimination. Own bounded implementation; exact
  independent residual fixtures rather than a claim of floating-point conditioning.
  <https://dlmf.nist.gov/3.2>
- SciPy's bisection contract: continuous function and sign-changing bracket. The
  implementation is our rational polynomial bisection, not a SciPy runtime dependency.
  <https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.bisect.html>
- MCP 2025-06-18 Tools: names, input schemas and output schemas. Comparing supplied
  digest declarations is not official conformance or the existing $49 live A2A/MCP
  compatibility pack.
  <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- Religion uses existing public, digest-pinned Maha registries and their source locators.
  No new textual inspection is claimed. Outputs use metadata and Maha's existing
  paraphrases, never source full text or a redistribution license. Commercial rights
  review remains required before launch. NC TextGrid-dependent topics are refused;
  source omissions are not used to manufacture an eligible packet.
- Policy products implement comparisons of caller declarations. No law was interpreted,
  no jurisdiction applicability inferred and no compliance decision certified.

## Measurement and selection artifacts

- `content/discovery/micro-candidate-freeze-v1.json`: immutable 60-row proposal and
  24-offer baseline, created before selection. `--create` refuses overwriting.
- `content/discovery/micro60-selection-v1.json`: all 60 semantic decisions, comparisons,
  source/locator/rights/boundary requirements, scores and twelve selected IDs.
- `content/discovery/micro-next12-cost-observation-v2.json`: current measured local
  observation. Version 1 remains as superseded history, not silently replaced.
- `content/discovery/microproduct-examples.json`: 22 valid golden microproduct examples,
  including the original ten. All existing non-micro offer declarations remain intact.

Each selected implementation was exercised once on its example and 31 times on a
capped high-size fixture. The second observation binds schema and corpus module hashes
and follows the strengthening of output schemas to the exact per-offer amount.
Local observations do **not** measure Vercel startup, invocation billing, database
fees, settlement latency, all possible worst-case inputs or support cost. Cloud cost,
real margin and commercial demand remain unknown. Neither science/library availability
nor an internal test is evidence that customers will buy the product.

## Verification and remaining launch work

Initial focused run: 164 tests passed, including all 22 microproduct examples, synthetic
payment flows, catalog discovery, buyer checks and API documentation. Later focused
runs add freeze, semantic-partition, no-overwrite, private-artifact isolation and module
import-order regression checks. The final full-suite result is appended below after
running from a committed, clean local worktree.

Tests cover exact arithmetic, singular/inconsistent systems, root enclosure and
iteration exhaustion, covariance cross terms and PSD refusal, ambiguous names,
every atlas unit boundary, NC-topic refusal, scope/revision substitution, wildcard
disclosure, and missing/withdrawn publication views. All payment tests use injected
synthetic provider/ledger/chain behavior. No actual payment was made.

The original stateless delivery limitation remains: no stored result recovery after
a lost paid body. Do not automatically pay again. The existing merchant support/refund
procedure and production abuse/cost limits still need explicit launch review.

Next steps require separate owner authorization: reconcile the local commits with
current main, review the product contracts and rights scope, approve a bounded Preview
build, inspect actual served output/bundles, run authorized provider canaries, and only
then consider publication. These endpoints deliberately refuse Preview/Production POST
even if an operator accidentally adds them to payment resource configuration.

No claim of production bundle privacy, Vercel readiness or Bazaar indexing is made from
local source and response tests.
