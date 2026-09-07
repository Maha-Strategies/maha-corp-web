import { createHash } from 'node:crypto'

export type Tranche19State = 'evidence-ready' | 'revise' | 'blocked'

export type LocalApplicationSource = {
  sourceId: string
  locator: string
  scope: string
  boundary: string
  roles: readonly string[]
}

const source = (
  sourceId: string,
  locator: string,
  roles: readonly string[],
  scope: string,
  boundary: string,
): LocalApplicationSource => ({ sourceId, locator, roles, scope, boundary })

export const LOCAL_APPLICATION_SOURCES: Readonly<Record<string, readonly LocalApplicationSource[]>> = {
  'urn:maha:concept:evidence:runtime-witness-receipts': [
    source('t19-runtime-attachment', 'lib/evidence-dossier/runtime-witness.ts — attachRuntimeWitnessToDossier', ['workflow'], 'Binds a validated runtime receipt to exact dossier, claim, and calculation identities.', 'Records one execution; it does not establish correctness or independent reproduction.'),
    source('t19-runtime-verifier', 'lib/evidence-dossier/runtime-witness.ts — verifyComputationalWitnessReceipt', ['verification', 'failure-modes'], 'Checks required receipt fields, hashes, timestamps, status, seeds, and artifacts.', 'A clean structural verification does not validate the computation or its inputs.'),
  ],
  'urn:maha:concept:evidence:claim-intake': [
    source('t19-claim-intake-parser', 'lib/evidence-preflight.ts — parseEvidencePreflightInput', ['workflow', 'failure-modes'], 'Accepts at most three separately structured claims with source, excerpt, locator, and rights fields.', 'The caller supplies claim separation and excerpts; parsing performs no source inspection.'),
    source('t19-claim-intake-verifier', 'lib/evidence-preflight.ts — verifyEvidencePreflightResult', ['verification'], 'Recomputes and checks the digest-bound structural preflight result.', 'Verification covers result consistency, not the truth or identity of submitted evidence.'),
    source('t19-claim-intake-commercial-state', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_COMMERCIAL_STATES', ['commercial-use'], 'Declares the structural preflight available free and distinguishes disabled or private next steps.', 'It does not establish purchase availability for a dossier or a completed customer engagement.'),
  ],
  'urn:maha:concept:evidence:uncertainty-recording': [
    source('t19-basis-boundaries', 'lib/evidence-basis.ts — BASIS_CONTRACT', ['workflow'], 'Requires every evidence basis to state what it cannot establish.', 'This is evidence-scope uncertainty, not metrological measurement uncertainty.'),
    source('t19-frame-transfer-refusal', 'lib/evidence-basis.ts — assertBasisCanCarry', ['verification', 'failure-modes'], 'Refuses evidentiary frame transfers that the declared basis cannot carry.', 'A passing basis check does not assess the source or the claim-specific passage.'),
  ],
  'urn:maha:concept:evidence:correction-and-retraction': [
    source('t19-release-transition', 'lib/epistemic-release.ts — buildEpistemicCanonicalRelease and buildEpistemicReleaseWithdrawal', ['workflow'], 'Implements superseding releases and separately recorded withdrawals.', 'This is Maha release behavior, not a general scholarly correction policy.'),
    source('t19-release-status', 'lib/epistemic-release.ts — epistemicReleaseStatus and activeEpistemicReleases', ['verification'], 'Derives active, superseded, and withdrawn status and excludes non-active releases.', 'It cannot invalidate copies or caches outside this system.'),
    source('t19-release-readiness', 'lib/epistemic-release.ts — releaseReadiness', ['failure-modes'], 'Refuses release when exact target, scope, decision, or authority conditions are incomplete.', 'Refusal coverage is bounded to the implemented checks.'),
  ],
  'urn:maha:concept:evidence:evidence-dossiers': [
    source('t19-dossier-compiler', 'lib/evidence-dossier/compiler.ts — compileEvidenceDossier', ['workflow'], 'Compiles typed sources, passages, claims, comparisons, limitations, and provenance into a dossier.', 'Compilation does not establish evidentiary sufficiency or truth.'),
    source('t19-dossier-validator', 'lib/evidence-dossier/validator.ts — validateDossier', ['verification', 'failure-modes'], 'Checks dossier schema, identities, transitions, and nested provenance consistency.', 'A valid package can still contain weak or misinterpreted evidence.'),
  ],
  'urn:maha:concept:evidence:licensed-retrieval': [
    source('t19-licensed-retrieval-flow', 'lib/mcp-evidence-licensing.ts — buildMcpEvidenceGrantSnapshot and buildLicensedEvidenceProjection', ['workflow', 'verification'], 'Binds client, grant, plan, quota, tool, active release, and returned projection.', 'Entitlement does not upgrade evidence quality or establish external interoperability.'),
    source('t19-licensed-retrieval-refusals', 'lib/mcp-evidence-licensing.ts — parseMcpEvidenceToolArguments and mcpEvidenceRequestSha256', ['failure-modes'], 'Requires one exact selector and binds material request arguments for replay safety.', 'Local parsing and digests do not prove hosted availability.'),
    source('t19-licensed-retrieval-commercial', 'lib/mcp-evidence-public-contract.ts — MCP_EVIDENCE_LICENSE_PLANS', ['commercial-use'], 'Declares plan identifiers, allowed tools, quotas, audiences, and list prices.', 'A listed private plan does not prove a signed contract, payment, or public runtime availability.'),
  ],
  'urn:maha:concept:evidence:calculation-receipts': [
    source('t19-receipt-registry-flow', 'lib/computational-witness-registry.ts — buildWitnessSubmissionPlan', ['workflow'], 'Builds a bounded, consented, replay-safe registry submission for a validated receipt.', 'Registration does not establish calculation correctness.'),
    source('t19-receipt-registry-verification', 'lib/computational-witness-registry.ts — validatedWitnessReceipt', ['verification'], 'Validates the computational witness schema before registry use.', 'Schema validity does not reproduce the calculation.'),
    source('t19-receipt-registry-failures', 'lib/computational-witness-registry.ts — WitnessRegistryInputError and WitnessRegistryConflictError', ['failure-modes'], 'Represents bounded-input and replay-conflict refusals.', 'It does not enumerate failures outside the registry boundary.'),
  ],
  'urn:maha:concept:evidence:delivery-acknowledgement': [
    source('t19-delivery-receipt-flow', 'lib/substantial-mcp-delivery-receipt.ts — buildSubstantialMcpDeliveryReceipt', ['workflow'], 'Binds execution, released revision, substantial publication, delivery state, and acknowledgement requirement.', 'A generated receipt does not prove external receipt, payment, or customer acceptance.'),
    source('t19-delivery-receipt-verifier', 'lib/substantial-mcp-delivery-receipt.ts — verifySubstantialMcpDeliveryReceipt', ['verification', 'failure-modes'], 'Rebuilds the receipt and checks exact digest-bound field consistency.', 'Verification establishes internal consistency only.'),
    source('t19-delivery-commercial-state', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_COMMERCIAL_STATES', ['commercial-use'], 'Labels licensed delivery as a private engagement rather than a public purchase flow.', 'It does not establish a customer, transaction, or Production delivery.'),
  ],
  'urn:maha:concept:evidence:internal-review': [
    source('t19-review-projection', 'lib/exact-revision-review.ts — projectReviewState', ['workflow', 'verification'], 'Projects review state only from decisions bound to the exact revision digest and separates stale decisions.', 'Internal review is not independent, expert, or peer review.'),
    source('t19-review-release-refusal', 'lib/exact-revision-review.ts — classifyForRelease', ['failure-modes'], 'Classifies exact-revision review completeness and refuses stale or incomplete bundles.', 'Classification does not authorize release by itself.'),
  ],
  'urn:maha:concept:evidence:privacy-boundary': [
    source('t19-private-bundle-scan', 'lib/batch-11-rehearsal-phases.ts — assertNoPrivateCorpusInBundle', ['workflow', 'verification', 'failure-modes'], 'Scans served bundle output against a fixed private-corpus marker set and refuses matches.', 'Passing proves absence of enumerated markers only, not general privacy or confidentiality.'),
  ],
  'urn:maha:concept:evidence:unsupported-inference': [
    source('t19-public-claim-defects', 'lib/public-claim-defects.ts — detectPublicClaimDefects', ['workflow', 'failure-modes'], 'Detects a bounded set of claim-to-passage scope and causal-language defects.', 'A clean result does not establish truth or support.'),
    source('t19-relevance-contract', 'lib/public-claim-defects.ts — RELEVANCE_CONTRACT', ['verification'], 'States that structural relevance checks do not independently verify truth.', 'This boundary is a contract, not an external evaluation.'),
    source('t19-preflight-commercial-state', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_COMMERCIAL_STATES', ['commercial-use'], 'Makes the structural preflight available free while keeping stronger offers separately labelled.', 'The free check does not verify source identity, passage support, or truth.'),
  ],
  'urn:maha:concept:evidence:canonical-release': [
    source('t19-canonical-release-flow', 'lib/epistemic-release.ts — buildEpistemicCanonicalRelease', ['workflow'], 'Creates an exact-target release under a separately authenticated release authority.', 'Release is publication, not factual verification.'),
    source('t19-canonical-release-verification', 'lib/epistemic-release.ts — releaseReadiness', ['verification', 'failure-modes'], 'Checks exact target, decision scopes, assurance tier, lineage, and authority prerequisites.', 'Passing does not establish empirical truth or independent reproduction.'),
  ],
  'urn:maha:concept:evidence:passage-support': [
    source('t19-passage-readiness', 'lib/release-readiness-policy-v2.ts — evaluateReadinessV2', ['workflow', 'verification', 'failure-modes'], 'Requires exact locator and claim-to-passage support decisions on one target under one policy.', 'A decision records review; it does not make the passage or claim true.'),
  ],
  'urn:maha:concept:evidence:audit-export': [
    source('t19-audit-export-generator', 'lib/audit/exporter.ts — generatePDF', [], 'Renders a bounded audit payload into a PDF export.', 'Generation is not verification; it establishes neither export completeness nor the truth of ledger events.'),
  ],
  'urn:maha:concept:evidence:version-relationship': [
    source('t19-version-state', 'lib/source-recovery.ts — validateObservation', ['failure-modes'], 'Keeps source identity and version-relationship uncertainty as explicit recovery findings.', 'It does not prove two artifacts are substantively equivalent.'),
  ],
  'urn:maha:concept:computation:reproducibility-fixtures': [
    source('t19-reproducibility-fixtures', 'lib/evidence-workflow-examples.ts — EVIDENCE_WORKFLOW_EXAMPLES', ['worked-example', 'reproducibility', 'uncertainty'], 'Provides committed synthetic inputs, expected outputs, refusals, checks, and explicit synthetic boundaries.', 'A fixture exercises a code path and is not independent scientific reproduction.'),
  ],
}

export const HELD_CONCEPTS: Readonly<Record<string, { state: Tranche19State; finding: string }>> = {
  'urn:maha:concept:evidence:conflicting-literature': { state: 'blocked', finding: 'No implementation compares two inspected sources on one shared claim; adjacent single-source checks cannot establish conflict.' },
  'urn:maha:concept:evidence:source-recovery': { state: 'revise', finding: 'Recovery-attempt code now exists, but the canonical definition object remains deferred and requires an exact-definition re-review before applications proceed.' },
  'urn:maha:concept:evidence:locator-verification': { state: 'revise', finding: 'The current preflight validates locator structure but explicitly performs no independent source fetch or locator inspection.' },
  'urn:maha:concept:computation:error-budgets': { state: 'revise', finding: 'The inspected SRE source defines an error budget; no route-specific Maha service, replay fixture, uncertainty protocol, or machine interface was inspected.' },
  'urn:maha:concept:computation:deterministic-arithmetic': { state: 'revise', finding: 'Its external-authority definition remains unaccepted because IEEE 754 scope alone does not establish cross-platform deterministic replay.' },
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

export function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}
