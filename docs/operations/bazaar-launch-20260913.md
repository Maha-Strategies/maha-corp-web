# Bazaar launch: 23 approved resources

Status: pricing and discovery copy deployed via PR #433. All 23 live declarations,
unsigned payment challenges and CDP validations passed. The first publisher-funded
payment ($.006) settled and its revised Bazaar listing was observed at
2026-09-13T06:37:50Z. The remaining 22 are a separate, reconciled continuation.

Owner approval: finalize narrow-utility prices, improve all 23 listings and focus
promotion on four workflows. Exclude all offers at $1 or above. Wallet funding
does not authorize expanding beyond this cohort. Absolute payment ceiling $5;
the current cohort costs $1.28 for one settlement per endpoint, excluding any
separately billed infrastructure fees. No extra payments for delayed indexing.

## Seven final launch price changes

| Endpoint | Prior USDC | Launch USDC |
|---|---:|---:|
| exact-linear-system | .034 | .011 |
| bracketed-polynomial-root | .032 | .009 |
| covariance-uncertainty | .027 | .013 |
| policy-version-comparison | .044 | .017 |
| control-evidence-gaps | .046 | .019 |
| mcp-contract-compatibility | .040 | .015 |
| tool-permission-diff | .042 | .021 |

Other 16 launch prices unchanged. Old amounts remain reserved in the catalog
for historical attribution. Distinct amounts are an accounting constraint,
not evidence of demand; a two-fee price-spacing rule is not necessary.

## Profitability gates

Prices are launch hypotheses, not profit or demand claims. Measure actual
variable costs: facilitator, model, compute, storage, egress and failed delivery.
Target 80% contribution margin for deterministic utilities and 60% for
model-backed work; do not call those margins achieved until measured.
At a price p, an 80% target permits at most 0.2p variable cost. For the cheapest
changed utility (.009), that permits .0018 per invocation. Reserve .001 for a
facilitator transaction when outside its monthly free tier; that leaves .0008
for other variable costs. The local v5 profile measures process workloads,
not Vercel bills or a proof of worst-case cost. Preserve prior profile versions.
Company profitability also requires covering maintenance and owner time.

## Release and execution

1. Review/test and release this branch through the normal site deployment path.
   Never deploy an older checkout or unrelated dirty changes. Reconcile enabled
   X402_RESOURCES descriptions/prices with the catalog without adding endpoints.
2. Run the plan without credentials:
   `node --experimental-strip-types scripts/run-bazaar-listing-refresh.ts --phase=launch-remaining --plan`
3. Check all live declarations and unsigned challenges; validate each resource
   with CDP. The execution preflight refuses a stale production declaration or
   a rejected validation before accessing a signing key.
4. Bind authorization to the exact remaining plan digest, 22 IDs, descriptions, schemas,
   sample requests, network, seller and total. Signing credentials belong only
   in the existing main-branch-restricted environment, never chat or shell history.
   That environment has no required human reviewer; manual dispatch and the exact
   confirmation are the approval gates. Do not describe it as reviewer-protected.
5. Preserve a unique evidence file. An existing file must not be overwritten.
   Before any rerun reconcile all prior transaction hashes and uncertain attempts;
   changing the output filename is NOT permission to repeat payments.
6. Verify settlement and output separately. A 202 is job acceptance, not final
   result delivery: retrieve async results before reporting delivery complete.
7. Read Bazaar back for price AND metadata, not just successful payment. Index
   processing may lag. Stop and diagnose rejection; never pay again for lag.

The old `--phase=all` still means eight offers. Original `--phase=launch` execution
is now blocked to prevent repaying the first offer. Use `--phase=launch-remaining`
for the remaining 22, exactly $1.274; it rechecks the first receipt and index
before any signing. These descriptions refresh even if a price already matches.
First transaction:
`0x181377b88f3c37c80675c2a1c13e61a6864d73fa47e278e794d6ec1d1a5e6c67`.
Its index was not visible within the initial one-minute window but subsequently
appeared without another payment. Continuation rows are observed briefly and
any pending listings must be reconciled read-only. Never rerun the entire
continuation after a partial or successful paid run.
No messages, community posts, artificial demand claims or automatic recurring
payments are authorized by this technical release.

## Four promotion workflows (drafts; not sent)

### Evidence review: citation binding → lineage → audit export

"Before an evidence handoff, check whether the declared source revision and
locator match, whether the revision transition is consistent, and whether the
event export is deterministic. These are metadata checks, not proof that a
source supports a claim. Each endpoint publishes a synthetic request and result."

Audience: evidence/RAG developers in existing collaborator conversations.
Lead with citation binding; invite one synthetic mismatch example, not private
clinical data. Success: a useful externally delivered result, then repeat use.

### Release checks: publication consistency → MCP declarations → permissions

"Before releasing an agent integration, compare declared publication digests,
MCP schema digests and explicit permission changes. Surface stale views and
new wildcard permissions without claiming a live security or conformance audit."

Audience: MCP/tool maintainers. Lead with a deliberately changed schema digest.
All supplied examples are free to inspect; paid calls operate on the buyer's
supported inputs. Do not market this as a substitute for security review.

### Context budgets: compression/evaluation → budget ladder → governed pack

"Compare five context budgets on the same documents and inspect what survives.
Label the evidence spans you need and measure their exact retention. Token
estimates and retained spans are inspectable; correctness is not guaranteed."

Audience: current context-tool users. Existing compression/evaluation prices
and listing status remain outside the paid 23-offer launch cohort.

### Governance review: policy changes → declared gaps → MPS audit

"Start with caller-declared clauses and evidence descriptors. Find changed
clauses and missing or stale matches before a human review. Model-backed MPS
classification is a separate optional step, not a compliance certificate."

Audience: technical governance leads. Show a synthetic stale-revision case.
No promise of legal validity, control effectiveness or verified factual truth.

## Measurement

For each resource track observed discovery/preview activity where available,
payment attempts, external settlements, completed delivery, repeats, revenue,
variable costs and refunds. Unavailable Bazaar impressions remain unknown.
Exclude the operator buyer wallet and collaborator tests from organic demand.
Review manually after two weeks; no scheduled monitor is enabled. Low traffic
calls for distribution work; payment failures call for interoperability work;
repeat useful purchases justify investigating bundles or price increases.
