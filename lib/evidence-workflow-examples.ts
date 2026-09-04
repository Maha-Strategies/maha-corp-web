import cohort from '../content/evidence-workflows/cohort-v1.json' with { type: 'json' }

import { provenanceDigest } from './evidence-dossier/digest.ts'
import { DOSSIER_SCHEMA_VERSION } from './evidence-dossier/schema.ts'
import { COMPUTATIONAL_WITNESS_SCHEMA } from './evidence-dossier/runtime-witness.ts'
import {
  EVIDENCE_PREFLIGHT_PRICE_USD,
  type EvidencePreflightInput,
  type EvidencePreflightResult,
} from './evidence-preflight-contract.ts'
import { compileEvidencePreflight, verifyEvidencePreflightResult } from './evidence-preflight.ts'
import {
  MCP_EVIDENCE_LICENSE_PLANS,
  MCP_EVIDENCE_LICENSE_TERMS_SHA256,
  MCP_EVIDENCE_PROJECTION_VERSION,
  MCP_EVIDENCE_TOOL_NAME,
} from './mcp-evidence-public-contract.ts'
import { SUBSTANTIAL_MCP_RECEIPT_VERSION } from './substantial-mcp-delivery-public-contract.ts'
import { KERNEL_RECEIPT_SCHEMA } from '../packages/wasm-kernel/src/receipt.ts'

export const EVIDENCE_WORKFLOW_VERSION = 'maha-public-evidence-workflows/1.0' as const
export const EVIDENCE_WORKFLOW_DATE = '2026-09-04' as const
export const EVIDENCE_WORKFLOW_PATH = '/knowledge/evidence-workflows' as const
export const EVIDENCE_WORKFLOW_REGISTRY_PATH = `${EVIDENCE_WORKFLOW_PATH}/registry` as const

export const EVIDENCE_WORKFLOW_CATEGORIES = [
  'evidence-preflight',
  'dossier-calculation-receipt',
  'mcp-release-flow',
] as const

export type EvidenceWorkflowCategory = typeof EVIDENCE_WORKFLOW_CATEGORIES[number]

export interface EvidenceWorkflowContractLink {
  title: string
  path: string
  role: 'public-tool' | 'method' | 'release-ledger' | 'governance-guide' | 'commercial-contact'
}

export interface EvidenceWorkflowFixture {
  artifactKind: 'preflight-result' | 'dossier-package' | 'calculation-receipt' | 'runtime-witness' | 'licensed-delivery'
  schemaVersion: string
  synthetic: true
  input: Readonly<Record<string, unknown>>
  expected: Readonly<Record<string, unknown>>
  boundary: string
  artifactSha256: string
}

export interface EvidenceWorkflowExample {
  slug: string
  category: EvidenceWorkflowCategory
  title: string
  question: string
  summary: string
  startingInputs: readonly string[]
  orderedSteps: readonly string[]
  expectedOutputs: readonly string[]
  refusalConditions: readonly string[]
  verificationChecks: readonly string[]
  contractLinks: readonly EvidenceWorkflowContractLink[]
  commercialNextStep: {
    label: string
    path: string
    state: 'available-free' | 'informational-purchase-disabled' | 'private-engagement'
  }
  boundary: string
  preflightResult: EvidencePreflightResult | null
  fixture: EvidenceWorkflowFixture
  workflowSha256: string
}

interface WorkflowSeed extends Omit<EvidenceWorkflowExample, 'preflightResult' | 'fixture' | 'workflowSha256'> {
  preflightInput?: EvidencePreflightInput
  fixture: Omit<EvidenceWorkflowFixture, 'artifactSha256'>
}

const PREFLIGHT_LINKS: readonly EvidenceWorkflowContractLink[] = [
  { title: 'Run the free Evidence Preflight', path: '/tools/evidence-preflight', role: 'public-tool' },
  { title: 'Read the Maha Provenance Standard', path: '/mps', role: 'method' },
  { title: 'Scope a human evidence audit', path: '/evidence-audit', role: 'commercial-contact' },
]

const DOSSIER_LINKS: readonly EvidenceWorkflowContractLink[] = [
  { title: 'Start with the free Evidence Preflight', path: '/tools/evidence-preflight', role: 'public-tool' },
  { title: 'Understand a full evidence audit', path: '/evidence-audit', role: 'commercial-contact' },
  { title: 'Inspect the canonical release ledger', path: '/knowledge/epistemic-system/releases', role: 'release-ledger' },
]

const MCP_LINKS: readonly EvidenceWorkflowContractLink[] = [
  { title: 'Enterprise MCP Gateway', path: '/enterprise-mcp-gateway', role: 'commercial-contact' },
  { title: 'MCP governance guide', path: '/guides/enterprise-mcp-governance', role: 'governance-guide' },
  { title: 'Canonical release ledger', path: '/knowledge/epistemic-system/releases', role: 'release-ledger' },
]

const PREFLIGHT_BOUNDARY = 'A preflight result checks the structure supplied by the caller. It does not fetch, read, authenticate, or verify a source and it does not certify the claim.'
const DOSSIER_BOUNDARY = 'A valid package proves internal consistency, declared provenance, and tamper detection. It does not by itself prove that a scientific claim is true, replicated, safe, or fit for a consequential decision.'
const MCP_BOUNDARY = 'Entitlement changes machine access only. It never changes evidence quality, canonical release state, source rights, uncertainty, or the authority of the underlying record.'

function preflightInput(
  requestId: string,
  claims: EvidencePreflightInput['claims'],
): EvidencePreflightInput {
  return { requestId, submissionConfirmedNonConfidential: true, claims }
}

const preflightInputs = {
  exactDoi: preflightInput('epf_public-example-doi-001', [{
    claim: 'The synthetic method reports an interval estimate for measurement uncertainty.',
    source: { kind: 'doi', identifier: '10.1234/example.001', title: 'Synthetic uncertainty method' },
    excerpt: 'The synthetic method reports an interval estimate for measurement uncertainty.',
    locator: { kind: 'section', value: '§ 3, Uncertainty model' },
    rights: { basis: 'open-license', accessStatus: 'open', licenseOrPermission: 'CC BY 4.0 (synthetic example declaration)' },
  }]),
  publicUrl: preflightInput('epf_public-example-url-002', [{
    claim: 'The worked example records the input digest before execution.',
    source: { kind: 'url', identifier: 'https://example.org/evidence/worked-method', title: 'Synthetic worked method' },
    excerpt: 'The worked example records the input digest before execution.',
    locator: { kind: 'paragraph', value: 'Worked example, paragraph 2' },
    rights: { basis: 'permission-confirmed', accessStatus: 'open', licenseOrPermission: 'Synthetic public example' },
  }]),
  metadataOnly: preflightInput('epf_public-example-meta-003', [{
    claim: 'The candidate paper reports a bounded calibration procedure.',
    source: { kind: 'doi', identifier: '10.1234/example.003', title: 'Synthetic calibration paper' },
    rights: { basis: 'limited-quotation-review', accessStatus: 'open' },
  }]),
  causal: preflightInput('epf_public-example-causal-004', [{
    claim: 'The synthetic intervention always causes complete recovery.',
    source: { kind: 'doi', identifier: '10.1234/example.004', title: 'Synthetic observational result' },
    excerpt: 'An association was observed in the synthetic sample; causal direction was not tested.',
    locator: { kind: 'page', value: 'p. 12' },
    rights: { basis: 'limited-quotation-review', accessStatus: 'open' },
  }]),
  invalidIdentity: preflightInput('epf_public-example-identity-005', [{
    claim: 'The candidate source describes the declared protocol.',
    source: { kind: 'doi', identifier: 'doi:not-a-valid-doi', title: 'Unresolved synthetic source' },
    excerpt: 'The candidate source describes the declared protocol.',
    locator: { kind: 'section', value: 'Methods § 2' },
    rights: { basis: 'permission-confirmed', accessStatus: 'open', licenseOrPermission: 'Synthetic public example' },
  }]),
  missingLocator: preflightInput('epf_public-example-locator-006', [{
    claim: 'The synthetic benchmark fixes its scoring rule before evaluation.',
    source: { kind: 'url', identifier: 'https://example.org/evidence/benchmark', title: 'Synthetic benchmark' },
    excerpt: 'The synthetic benchmark fixes its scoring rule before evaluation.',
    rights: { basis: 'public-domain', accessStatus: 'open' },
  }]),
  uncertainRights: preflightInput('epf_public-example-rights-007', [{
    claim: 'The synthetic report lists three failure conditions.',
    source: { kind: 'url', identifier: 'https://example.org/evidence/restricted-report', title: 'Synthetic restricted report' },
    excerpt: 'The synthetic report lists three failure conditions.',
    locator: { kind: 'table', value: 'Table 4' },
    rights: { basis: 'unknown', accessStatus: 'restricted' },
  }]),
  mixed: preflightInput('epf_public-example-mixed-008', [
    {
      claim: 'The synthetic procedure records its declared precision policy.',
      source: { kind: 'doi', identifier: '10.1234/example.008a', title: 'Synthetic procedure' },
      excerpt: 'The synthetic procedure records its declared precision policy.',
      locator: { kind: 'section', value: '§ 4.1, Precision' },
      rights: { basis: 'open-license', accessStatus: 'open', licenseOrPermission: 'CC0 (synthetic example declaration)' },
    },
    {
      claim: 'The candidate source reports a comparison against a baseline.',
      source: { kind: 'doi', identifier: '10.1234/example.008b', title: 'Synthetic comparison' },
      rights: { basis: 'limited-quotation-review', accessStatus: 'open' },
    },
    {
      claim: 'The synthetic result proves universal safety.',
      source: { kind: 'url', identifier: 'https://example.org/evidence/safety', title: 'Synthetic safety note' },
      excerpt: 'The synthetic note reports one bounded test and makes no universal safety finding.',
      locator: { kind: 'paragraph', value: 'Results, paragraph 1' },
      rights: { basis: 'permission-confirmed', accessStatus: 'open', licenseOrPermission: 'Synthetic public example' },
    },
  ]),
} as const

function artifact(seed: Omit<EvidenceWorkflowFixture, 'artifactSha256'>): EvidenceWorkflowFixture {
  return { ...seed, artifactSha256: provenanceDigest(seed) }
}

function preflightSeed(input: EvidencePreflightInput, seed: Omit<WorkflowSeed, 'category' | 'preflightInput' | 'fixture'>): WorkflowSeed {
  const result = compileEvidencePreflight(input)
  return {
    ...seed,
    category: 'evidence-preflight',
    preflightInput: input,
    fixture: {
      artifactKind: 'preflight-result', schemaVersion: result.schemaVersion, synthetic: true,
      input: { requestId: input.requestId, claimCount: input.claims.length, sourceKinds: input.claims.map((claim) => claim.source.kind) },
      expected: { summary: result.summary, blockerSets: result.assessments.map((assessment) => assessment.blockers), resultSha256: result.resultSha256 },
      boundary: PREFLIGHT_BOUNDARY,
    },
  }
}

const preflightSeeds: readonly WorkflowSeed[] = [
  preflightSeed(preflightInputs.exactDoi, {
    slug: 'doi-with-exact-locator', title: 'Preflight a DOI with an exact locator', question: 'What changes when a DOI, excerpt, and exact section are all supplied?', summary: 'A complete structural packet can be routed to source inspection, while the preflight still refuses to call the claim verified.',
    startingInputs: ['One bounded synthetic claim', 'A DOI-shaped identifier', 'An authorized excerpt', 'A section-level locator and rights declaration'], orderedSteps: ['Normalize the DOI without resolving it.', 'Check that the excerpt and locator are both present.', 'Compare claim and excerpt language for routing risk.', 'Record rights and access declarations.', 'Digest the complete structural result.'], expectedOutputs: ['Ready-for-source-inspection status', 'No structural blocker codes', 'A reproducible result digest'], refusalConditions: ['A valid DOI is treated as proof the source exists.', 'The excerpt is presented as independently authenticated.', 'Structural readiness is relabelled as verification.'], verificationChecks: ['Recompute the result digest.', 'Confirm independentSourceInspectionPerformed remains false.', 'Confirm no submitted content is retained by Maha.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Run your own free preflight', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.publicUrl, {
    slug: 'public-url-with-authorized-excerpt', title: 'Preflight a public URL and authorized excerpt', question: 'Can a public HTTPS source enter preflight without being fetched by Maha?', summary: 'The caller supplies the excerpt and locator; the tool checks structure while making no claim that it opened the URL.',
    startingInputs: ['A public HTTPS URL', 'A caller-authorized synthetic excerpt', 'A paragraph locator', 'A permission declaration'], orderedSteps: ['Reject local, private, credentialed, or non-HTTPS addresses.', 'Normalize the public URL.', 'Classify the excerpt as caller-supplied.', 'Assess locator, scope, inference, and rights fields.', 'Return the digest-bound result to the browser.'], expectedOutputs: ['Normalized public URL', 'Caller-supplied-located evidence status', 'Explicit no-fetch boundary'], refusalConditions: ['The URL targets a private network.', 'The page is said to have been opened.', 'Permission is inferred from public reachability.'], verificationChecks: ['The normalized identifier remains HTTPS.', 'The result states no independent inspection occurred.', 'The result digest fails after any field mutation.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Run the free structural check', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.metadataOnly, {
    slug: 'metadata-only-source', title: 'Route a metadata-only source honestly', question: 'What should happen when a citation exists but no passage was supplied?', summary: 'The preflight keeps bibliographic identity separate from content evidence and blocks the claim before inspection.',
    startingInputs: ['A bounded synthetic claim', 'A DOI and title', 'No excerpt', 'No exact locator'], orderedSteps: ['Validate only the identifier format.', 'Mark the evidence state metadata-only.', 'Emit missing-passage and locator blockers.', 'Keep the claim out of explanatory use.', 'Name the evidence needed to continue.'], expectedOutputs: ['Metadata-only status', 'Blocked-before-source-inspection status', 'A concrete request for excerpt and locator'], refusalConditions: ['The title is used as evidence.', 'An abstract is invented from metadata.', 'The record is counted as content-inspected.'], verificationChecks: ['metadataOnly equals one.', 'readyForSourceInspection equals zero.', 'The blocker set includes source-metadata-only.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Supply a lawful excerpt in preflight', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.causal, {
    slug: 'unsupported-causal-inference', title: 'Catch an unsupported causal inference', question: 'Can an observational excerpt support a universal causal claim?', summary: 'Lexical and scope checks route the claim for revision; they do not attempt to settle causality.',
    startingInputs: ['A universal causal claim', 'An observational excerpt', 'An exact page', 'A declared quotation basis'], orderedSteps: ['Detect absolute and causal language in the claim.', 'Compare the claim vocabulary with the excerpt.', 'Preserve the excerpt’s non-causal boundary.', 'Emit scope and inference blocker codes.', 'Route the claim to revision before source review.'], expectedOutputs: ['Overbroad-language status', 'Causal-language risk', 'Blocked-before-source-inspection status'], refusalConditions: ['Association is rewritten as causation.', 'One sample is generalized universally.', 'A lexical warning is called a factual verdict.'], verificationChecks: ['The result contains unsupported-inference-risk.', 'The result contains claim-scope-overbroad.', 'No truth or safety certification is emitted.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Test a revised bounded claim', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.invalidIdentity, {
    slug: 'source-identity-mismatch', title: 'Refuse an invalid source identity', question: 'What if the declared DOI does not have DOI syntax?', summary: 'The source remains unresolved even when the excerpt looks relevant; topical text cannot repair a broken identity.',
    startingInputs: ['A plausible synthetic claim', 'A malformed DOI declaration', 'A matching excerpt', 'An exact locator'], orderedSteps: ['Parse the declared identifier by source kind.', 'Refuse invalid DOI syntax.', 'Keep excerpt relevance separate from source identity.', 'Emit the identity blocker.', 'Request a valid DOI or public URL.'], expectedOutputs: ['Declared-format-invalid status', 'source-identifier-invalid blocker', 'No source-resolution claim'], refusalConditions: ['The title substitutes for an identifier.', 'A matching excerpt erases identity failure.', 'A guessed DOI is silently inserted.'], verificationChecks: ['normalizedIdentifier remains the submitted value.', 'The claim is blocked.', 'No network lookup is represented.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Correct the identifier and retry', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.missingLocator, {
    slug: 'incomplete-locator', title: 'Refuse an unlocated excerpt', question: 'Why is a relevant excerpt insufficient without a precise locator?', summary: 'A reader must be able to find the passage in the declared version; an excerpt without location stays blocked.',
    startingInputs: ['A bounded synthetic claim', 'A valid public URL', 'A matching excerpt', 'No locator'], orderedSteps: ['Validate the URL syntax.', 'Recognize that excerpt content was supplied.', 'Check for a bounded locator.', 'Mark the excerpt unlocated.', 'Request a page, section, figure, table, equation, paragraph, or timestamp.'], expectedOutputs: ['User-supplied-unlocated-excerpt status', 'exact-locator-missing blocker', 'Blocked routing decision'], refusalConditions: ['The entire document is accepted as a locator.', 'The excerpt is treated as independently inspected.', 'A locator is guessed.'], verificationChecks: ['locatorStatus is locator-missing.', 'The result digest covers the missing locator.', 'Adding a locator changes the digest.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Add the exact locator', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.uncertainRights, {
    slug: 'rights-and-access-uncertain', title: 'Keep rights and access uncertainty visible', question: 'Does access to a document establish permission to reuse it?', summary: 'No. Access status and reuse basis remain separate fields, and either can block further processing.',
    startingInputs: ['A synthetic claim and excerpt', 'A public URL shape', 'A table locator', 'Unknown rights and restricted access'], orderedSteps: ['Record access status without equating it to rights.', 'Record the reuse basis without inferring a licence.', 'Emit both access and rights blockers.', 'Keep the excerpt out of a public package.', 'Request lawful access and a named basis.'], expectedOutputs: ['Restricted rights assessment', 'rights-basis-unresolved blocker', 'source-access-restricted blocker'], refusalConditions: ['Public metadata becomes permission.', 'Restricted text enters the public registry.', 'A licence is inferred from silence.'], verificationChecks: ['The rights status is restricted.', 'The result remains blocked.', 'No excerpt appears in the workflow registry fixture.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: 'Review the non-confidential submission rules', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: PREFLIGHT_BOUNDARY,
  }),
  preflightSeed(preflightInputs.mixed, {
    slug: 'three-claim-mixed-preflight', title: 'Preflight three claims with mixed outcomes', question: 'Can one request preserve ready and blocked claims without averaging them?', summary: 'Each claim receives its own decision; one complete claim cannot make two incomplete claims look ready.',
    startingInputs: ['Three synthetic claims', 'Mixed DOI and URL identifiers', 'One metadata-only citation', 'One overbroad safety claim'], orderedSteps: ['Validate the request-level three-claim bound.', 'Assess every claim independently.', 'Keep blocker codes attached to their claim.', 'Aggregate counts without averaging status.', 'Digest the ordered result.'], expectedOutputs: ['One request-level result', 'Per-claim blocker sets', 'Ready, blocked, metadata-only, and located counts'], refusalConditions: ['A ready claim clears the whole request.', 'Blockers migrate between claims.', 'The safety claim is softened only in the summary.'], verificationChecks: ['claimCount equals three.', 'At least one claim is ready and at least one blocked.', 'Reordering or editing claims changes the result digest.'], contractLinks: PREFLIGHT_LINKS, commercialNextStep: { label: `Review the proposed $${EVIDENCE_PREFLIGHT_PRICE_USD} bounded dossier`, path: '/tools/evidence-preflight#future-offer', state: 'informational-purchase-disabled' }, boundary: PREFLIGHT_BOUNDARY,
  }),
]

const dossierSeeds: readonly WorkflowSeed[] = [
  {
    slug: 'verify-jsonld-evidence-package', category: 'dossier-calculation-receipt', title: 'Verify a JSON-LD Evidence Dossier package', question: 'What must be checked before trusting a dossier package?', summary: 'Recompute file, passage, claim, and package digests before reading the document as a coherent evidence artifact.',
    startingInputs: ['A synthetic dossier manifest', 'JSON-LD and canonical JSON files', 'Declared source and passage digests', 'The package digest'], orderedSteps: ['Validate the manifest schema and exact file set.', 'Canonicalize every JSON artifact under the declared version.', 'Recompute file and nested provenance digests.', 'Recompute the package digest over the manifest body.', 'Only then inspect review state and limitations.'], expectedOutputs: ['A complete digest-verification report', 'An explicit review-state reading', 'A refusal list when any byte differs'], refusalConditions: ['A PDF is treated as the source of truth.', 'A manifest-provided digest is trusted without recomputation.', 'Valid packaging is relabelled scientific validation.'], verificationChecks: ['All declared files exist exactly once.', 'Every digest recomputes.', 'The dossier review state remains unchanged by verification.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: `Proposed bounded dossier — $${EVIDENCE_PREFLIGHT_PRICE_USD}, purchase disabled`, path: '/tools/evidence-preflight#future-offer', state: 'informational-purchase-disabled' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'dossier-package', schemaVersion: DOSSIER_SCHEMA_VERSION, synthetic: true, input: { files: ['dossier.json', 'dossier.jsonld', 'manifest.json'], canonicalization: 'maha-dossier-canonical/1.0' }, expected: { verification: 'all-digests-recomputed', reviewState: 'unchanged' }, boundary: DOSSIER_BOUNDARY },
  },
  {
    slug: 'detect-manifest-tampering', category: 'dossier-calculation-receipt', title: 'Detect manifest and payload tampering', question: 'What if a file and its listed digest are both edited?', summary: 'The outer package digest binds the manifest, so coordinated edits still fail unless the package identity also changes.',
    startingInputs: ['A verified synthetic package', 'One changed payload byte', 'An edited file digest', 'The original package digest'], orderedSteps: ['Recompute the changed file digest.', 'Compare it with the edited manifest entry.', 'Recompute the package digest over the edited manifest.', 'Compare it with the immutable package identity.', 'Refuse the package when the outer digest differs.'], expectedOutputs: ['File-level match after coordinated edit', 'Package-level mismatch', 'A tamper refusal rather than a repaired package'], refusalConditions: ['The manifest is allowed to self-authorize.', 'The package digest is rewritten in place.', 'The altered package retains the old identity.'], verificationChecks: ['The outer digest covers manifest entries.', 'A one-byte mutation changes package identity.', 'Prior package bytes remain recoverable.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: 'Scope a governed evidence audit', path: '/evidence-audit', state: 'private-engagement' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'dossier-package', schemaVersion: DOSSIER_SCHEMA_VERSION, synthetic: true, input: { mutation: 'one-byte-payload-change', manifestDigestAlsoEdited: true }, expected: { fileDigestCheck: 'pass', packageDigestCheck: 'refuse' }, boundary: DOSSIER_BOUNDARY },
  },
  {
    slug: 'recompute-calculation-receipt', category: 'dossier-calculation-receipt', title: 'Recompute a deterministic calculation receipt', question: 'Can a dossier calculation be checked without trusting its displayed answer?', summary: 'The verifier repeats a fixed-point interval operation from explicit inputs, units, arithmetic policy, and kernel identity.',
    startingInputs: ['Left interval [10, 14] nanometres', 'Right interval [3, 5] nanometres', 'Signed-i64 fixed-point arithmetic', 'A pinned kernel and conformance identity'], orderedSteps: ['Validate canonical integer inputs and units.', 'Verify the kernel byte and conformance digests.', 'Execute interval addition.', 'Recompute input, output, and receipt digests.', 'Compare all outputs byte for byte.'], expectedOutputs: ['Output interval [13, 19] nanometres', 'Explicit lower and upper uncertainty bounds', 'A calculation-receipt digest'], refusalConditions: ['A unit is missing or substituted.', 'The kernel identity differs.', 'A displayed output is trusted without execution.'], verificationChecks: ['10 + 3 gives the lower bound 13.', '14 + 5 gives the upper bound 19.', 'Any input mutation changes the receipt identity.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: 'Discuss calculation-bound dossiers', path: '/contact', state: 'private-engagement' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'calculation-receipt', schemaVersion: KERNEL_RECEIPT_SCHEMA, synthetic: true, input: { operation: 'interval-add', leftLower: '10', leftUpper: '14', rightLower: '3', rightUpper: '5', unit: 'nm' }, expected: { resultLower: '13', resultUpper: '19', unit: 'nm' }, boundary: 'The arithmetic is reproducible; the synthetic inputs are not measurements and the result is not a scientific finding.' },
  },
  {
    slug: 'preserve-absent-calculation', category: 'dossier-calculation-receipt', title: 'Preserve an absent calculation instead of inventing one', question: 'What should a dossier do when a claim has no reproducible numerical inputs?', summary: 'It records that no calculation applies and keeps the calculation attachment empty.',
    startingInputs: ['A qualitative synthetic claim', 'One inspected passage', 'No variables or units', 'No uncertainty declaration'], orderedSteps: ['Ask whether the claim requires a calculation.', 'Look for complete variables, units, assumptions, and uncertainty.', 'Record each missing prerequisite.', 'Leave calculation attachments empty.', 'Keep prose evidence and computation status separate.'], expectedOutputs: ['calculationsApplicable set false', 'An empty receipt list', 'A reason naming the missing inputs'], refusalConditions: ['Numbers are inferred from prose.', 'A point estimate is fabricated.', 'An empty array is treated as a failed computation.'], verificationChecks: ['No numeric output appears.', 'No placeholder receipt digest appears.', 'The evidence claim remains independently reviewable.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: 'Check whether your claim is structurally ready', path: '/tools/evidence-preflight', state: 'available-free' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'dossier-package', schemaVersion: DOSSIER_SCHEMA_VERSION, synthetic: true, input: { claimKind: 'qualitative', declaredVariables: [], declaredUnits: [], uncertainty: null }, expected: { calculationsApplicable: false, calculationReceipts: [] }, boundary: 'Absence is an evidence state, not permission to fill the package with an estimate.' },
  },
  {
    slug: 'derive-pdf-after-verification', category: 'dossier-calculation-receipt', title: 'Render a PDF only after package verification', question: 'Why must the PDF remain a presentation layer?', summary: 'The human-readable report is derived from already-verified package data and never becomes a second source of truth.',
    startingInputs: ['A verified dossier JSON package', 'A deterministic section order', 'A fixed renderer version', 'No editable source claims in the PDF step'], orderedSteps: ['Verify the dossier package first.', 'Render only fields present in the verified object.', 'Record the PDF file digest in a new package manifest.', 'Check pagination and visible boundaries.', 'Distribute JSON-LD with the PDF.'], expectedOutputs: ['A readable PDF report', 'A digest for the rendered file', 'The original machine-verifiable package beside it'], refusalConditions: ['The PDF contains new prose.', 'The PDF is generated from an unverified package.', 'A visual correction silently edits evidence.'], verificationChecks: ['Every PDF section maps to a package field.', 'The PDF digest changes after any rendering-byte change.', 'JSON-LD remains authoritative for machine verification.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: 'Scope a dossier deliverable', path: '/evidence-audit', state: 'private-engagement' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'dossier-package', schemaVersion: DOSSIER_SCHEMA_VERSION, synthetic: true, input: { verifiedPackage: true, renderOrder: ['scope', 'claims', 'sources', 'limitations'], renderer: 'pinned' }, expected: { pdfAddsClaims: false, machinePackageIncluded: true }, boundary: 'Visual legibility can be inspected separately; it cannot repair or upgrade evidence.' },
  },
  {
    slug: 'bind-runtime-witness-to-dossier', category: 'dossier-calculation-receipt', title: 'Bind a runtime witness to a dossier claim', question: 'What does a computational provenance witness establish?', summary: 'It binds execution environment, inputs, outputs, seeds, and artifacts to claim and dossier identifiers without claiming independent reproduction.',
    startingInputs: ['A synthetic calculation claim', 'A calculation receipt identity', 'Hashed input and output artifacts', 'Runtime and environment metadata'], orderedSteps: ['Validate the witness schema and receipt digest.', 'Match dossier and claim identifiers.', 'Match calculation receipt identities.', 'Verify environment and artifact hashes.', 'Retain the independentlyReproduced flag as false.'], expectedOutputs: ['A dossier-bound witness attachment', 'Execution-observed status', 'Explicit non-reproduction boundary'], refusalConditions: ['Secrets appear in environment metadata.', 'The witness names another dossier.', 'One execution is called independent reproduction.'], verificationChecks: ['The witness digest recomputes.', 'Every attachment target exists.', 'Scientific validity remains uncertified.'], contractLinks: DOSSIER_LINKS, commercialNextStep: { label: 'Discuss witnessed computational evidence', path: '/contact', state: 'private-engagement' }, boundary: DOSSIER_BOUNDARY,
    fixture: { artifactKind: 'runtime-witness', schemaVersion: COMPUTATIONAL_WITNESS_SCHEMA, synthetic: true, input: { claimId: 'synthetic-claim-01', randomSeed: '17', inputArtifact: 'sha256:synthetic-input', outputArtifact: 'sha256:synthetic-output' }, expected: { executionObserved: true, independentlyReproduced: false, scientificValidityCertified: false }, boundary: 'The witness records what ran. It does not establish that the model, inputs, or conclusion are scientifically valid.' },
  },
]

const mcpSeeds: readonly WorkflowSeed[] = [
  {
    slug: 'discover-before-requesting', category: 'mcp-release-flow', title: 'Discover capability before requesting evidence', question: 'How should an agent decide whether a Maha tool can serve its task?', summary: 'Read public capability and boundary documents first; discovery describes a tool but grants no entitlement.',
    startingInputs: ['A machine task', 'Public MCP discovery', 'A maximum acceptable capability', 'No credential in the prompt'], orderedSteps: ['Read the public method and capability boundaries.', 'Compare the task with the declared tool contract.', 'Reject non-fit and high-stakes uses.', 'Request entitlement only for the exact tool.', 'Keep runtime availability separate from documentation.'], expectedOutputs: ['A fit or non-fit decision', 'The exact requested capability', 'A list of unresolved commercial prerequisites'], refusalConditions: ['Discovery is treated as authorization.', 'A private endpoint is guessed.', 'A broad credential is requested.'], verificationChecks: ['No tool call occurs during discovery.', 'No credential enters a public artifact.', 'A non-fit task terminates before entitlement.'], contractLinks: MCP_LINKS, commercialNextStep: { label: 'Discuss an enterprise MCP integration', path: '/enterprise-mcp-gateway', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION, synthetic: true, input: { phase: 'discovery', requestedTool: MCP_EVIDENCE_TOOL_NAME }, expected: { executionCreated: false, entitlementGranted: false }, boundary: MCP_BOUNDARY },
  },
  {
    slug: 'bind-machine-identity-to-entitlement', category: 'mcp-release-flow', title: 'Bind machine identity to a narrow entitlement', question: 'What must an evidence-retrieval credential be allowed to do?', summary: 'A credential, client, grant, plan, tool, validity window, and quota are bound into one immutable grant snapshot.',
    startingInputs: ['A verified client identity', 'A non-secret credential identifier', 'One evidence-retrieval plan', 'A bounded validity interval'], orderedSteps: ['Authenticate the credential outside tool arguments.', 'Resolve its client and active grant.', 'Match the grant to the exact tool name.', 'Check validity window and quota.', 'Bind the terms digest into the grant snapshot.'], expectedOutputs: ['An exact capability decision', 'A quota-bearing grant identity', 'No evidence output before authorization'], refusalConditions: ['Credential and grant belong to different clients.', 'The tool is absent from allowedTools.', 'A raw credential appears in a receipt.'], verificationChecks: ['The terms digest matches the public contract.', 'The credential is represented only by identifier or fingerprint.', 'Expired or revoked grants refuse.'], contractLinks: MCP_LINKS, commercialNextStep: { label: `Developer evidence plan — $${(MCP_EVIDENCE_LICENSE_PLANS['evidence-developer-v1'].listPriceUsdCents / 100).toLocaleString('en-US')}/month, private`, path: '/contact', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION, synthetic: true, input: { planId: 'evidence-developer-v1', allowedTools: [MCP_EVIDENCE_TOOL_NAME], termsSha256: MCP_EVIDENCE_LICENSE_TERMS_SHA256 }, expected: { monthlyQuotaUnits: MCP_EVIDENCE_LICENSE_PLANS['evidence-developer-v1'].monthlyQuotaUnits, runtimeState: 'private' }, boundary: MCP_BOUNDARY },
  },
  {
    slug: 'retrieve-exact-released-revision', category: 'mcp-release-flow', title: 'Retrieve only an exact active released revision', question: 'Why is a record identifier alone insufficient for licensed retrieval?', summary: 'The execution binds the selector to an active release, its target digest, release digest, and canonical path before returning evidence.',
    startingInputs: ['An authorized grant', 'One release ID or canonical path', 'An exact active release', 'Remaining quota'], orderedSteps: ['Parse exactly one selector.', 'Resolve an active release at that selector.', 'Reserve one replay-safe execution.', 'Project only the released record fields and boundaries.', 'Digest the projection and execution evidence.'], expectedOutputs: ['Exact release and target identities', 'Source-bound claims and limitations', 'A deterministic projection digest'], refusalConditions: ['The release is superseded or withdrawn.', 'The record revision differs from the active target.', 'Entitlement is used to upgrade evidence state.'], verificationChecks: ['The canonical path matches the release.', 'The target digest matches the projected record.', 'The license boundary remains in the output.'], contractLinks: MCP_LINKS, commercialNextStep: { label: 'Request a private licensed-evidence pilot', path: '/contact', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION, synthetic: true, input: { selector: 'one-release-id', releaseStatus: 'active', entitlement: 'valid' }, expected: { projection: 'exact-active-release-only', evidenceQualityChanged: false }, boundary: MCP_BOUNDARY },
  },
  {
    slug: 'refuse-stale-or-substituted-selector', category: 'mcp-release-flow', title: 'Refuse stale releases and substituted selectors', question: 'What stops a licensed request from returning a different record?', summary: 'Selector, request digest, active release, and execution reservation remain bound; changing any one creates a conflict rather than a convenient fallback.',
    startingInputs: ['An original selector', 'Its request digest', 'An idempotency key', 'A stale or substituted retry'], orderedSteps: ['Canonicalize the original tool arguments.', 'Bind the request digest to the reservation.', 'Resolve the selector against active releases.', 'Compare every retry with the original material request.', 'Refuse substitution, staleness, or withdrawal.'], expectedOutputs: ['A selector-conflict refusal', 'No replacement record', 'No quota charge for rejected substitution'], refusalConditions: ['A path silently falls back to another release.', 'A stale target is returned because quota remains.', 'A changed request reuses the prior execution.'], verificationChecks: ['Exactly one selector is accepted.', 'A material retry changes request identity.', 'No evidence bytes are returned on refusal.'], contractLinks: MCP_LINKS, commercialNextStep: { label: 'Review MCP release governance', path: '/guides/enterprise-mcp-governance', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION, synthetic: true, input: { originalSelector: 'release-A', retrySelector: 'release-B', sameIdempotencyKey: true }, expected: { outcome: 'idempotency-conflict', deliveredRecord: null }, boundary: MCP_BOUNDARY },
  },
  {
    slug: 'meter-and-replay-safely', category: 'mcp-release-flow', title: 'Meter one execution and replay it safely', question: 'How can an agent retry without consuming a second licensed unit?', summary: 'An identical request reuses the original execution identity and bytes; changed material under the same request ID is refused.',
    startingInputs: ['An active grant with quota', 'A stable client request ID', 'Canonical tool arguments', 'An active release'], orderedSteps: ['Reserve quota atomically before delivery.', 'Persist the request and release digests with the execution.', 'Return the licensed projection.', 'On retry, revalidate grant and active release.', 'Return identical bytes without a second reservation.'], expectedOutputs: ['One quota unit consumed', 'One execution identity', 'Byte-identical idempotent replay'], refusalConditions: ['Quota is checked after delivery.', 'A replay bypasses revocation.', 'A changed selector reuses the stored result.'], verificationChecks: ['The first call consumes one unit.', 'The exact replay consumes zero additional units.', 'Expired grants refuse even on replay.'], contractLinks: MCP_LINKS, commercialNextStep: { label: 'Evaluate a bounded private canary', path: '/enterprise-mcp-gateway', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: MCP_EVIDENCE_PROJECTION_VERSION, synthetic: true, input: { requestId: 'synthetic-replay-001', calls: 2, materialInputsEqual: true }, expected: { executions: 1, quotaUnitsConsumed: 1, secondOutcome: 'idempotent-replay' }, boundary: MCP_BOUNDARY },
  },
  {
    slug: 'acknowledge-digest-bound-delivery', category: 'mcp-release-flow', title: 'Acknowledge a digest-bound evidence delivery', question: 'What must a delivery receipt bind before acknowledgement?', summary: 'The receipt joins execution, request, projection, release, record revision, canonical path, and substantial publication into one independently checkable identity.',
    startingInputs: ['A licensed evidence projection', 'An eligible substantial page', 'Exact release and revision digests', 'A private delivery channel'], orderedSteps: ['Bind the execution and projection digests.', 'Match release target to the substantial-page revision.', 'Require complete claim coverage and zero unsupported paragraphs.', 'Compute the delivery-receipt digest.', 'Acknowledge that exact receipt once.'], expectedOutputs: ['A private machine-delivery receipt', 'acknowledgementRequired set true', 'A replay-safe acknowledgement identity'], refusalConditions: ['The page names another revision.', 'Delivery is unavailable.', 'An acknowledgement is accepted before delivery.'], verificationChecks: ['Receipt reconstruction is byte-identical.', 'The receipt says entitlementChangesEvidenceQuality false.', 'Acknowledgement cannot target a substituted digest.'], contractLinks: MCP_LINKS, commercialNextStep: { label: 'Discuss licensed delivery integration', path: '/contact', state: 'private-engagement' }, boundary: MCP_BOUNDARY,
    fixture: { artifactKind: 'licensed-delivery', schemaVersion: SUBSTANTIAL_MCP_RECEIPT_VERSION, synthetic: true, input: { execution: 'bound', release: 'exact-active', publication: 'eligible-exact-revision' }, expected: { deliveryState: 'private-machine-delivery', acknowledgementRequired: true, entitlementChangesEvidenceQuality: false }, boundary: MCP_BOUNDARY },
  },
]

const allSeeds: readonly WorkflowSeed[] = [...preflightSeeds, ...dossierSeeds, ...mcpSeeds]

export const EVIDENCE_WORKFLOW_EXAMPLES: readonly EvidenceWorkflowExample[] = allSeeds.map((seed) => {
  const result = seed.preflightInput ? compileEvidencePreflight(seed.preflightInput) : null
  const fixture = artifact(seed.fixture)
  const publicSeed = Object.fromEntries(Object.entries(seed).filter(([key]) => key !== 'preflightInput')) as Omit<WorkflowSeed, 'preflightInput'>
  const body = { ...publicSeed, preflightResult: result, fixture }
  return { ...body, workflowSha256: provenanceDigest(body) }
})

export const evidenceWorkflowPath = (workflow: Pick<EvidenceWorkflowExample, 'slug'>): string => `${EVIDENCE_WORKFLOW_PATH}/${workflow.slug}`
export const getEvidenceWorkflow = (slug: string): EvidenceWorkflowExample | undefined => EVIDENCE_WORKFLOW_EXAMPLES.find((workflow) => workflow.slug === slug)

export const EVIDENCE_WORKFLOW_QUALITY = EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => {
  const blockers: string[] = []
  if (workflow.startingInputs.length < 3) blockers.push('insufficient-input-contract')
  if (workflow.orderedSteps.length < 4) blockers.push('not-a-worked-example')
  if (workflow.expectedOutputs.length < 3) blockers.push('insufficient-output-contract')
  if (workflow.refusalConditions.length < 3) blockers.push('insufficient-refusals')
  if (workflow.verificationChecks.length < 3) blockers.push('insufficient-verification')
  if (workflow.contractLinks.length < 2) blockers.push('insufficient-contract-links')
  if (workflow.preflightResult && verifyEvidencePreflightResult(workflow.preflightResult).length) blockers.push('preflight-fixture-invalid')
  if (provenanceDigest({ ...workflow.fixture, artifactSha256: undefined }) !== workflow.fixture.artifactSha256) blockers.push('fixture-digest-invalid')
  const { workflowSha256, ...body } = workflow
  if (provenanceDigest(body) !== workflowSha256) blockers.push('workflow-digest-invalid')
  return { slug: workflow.slug, eligible: blockers.length === 0, blockers, informationDimensions: 9 }
})

export const EVIDENCE_WORKFLOW_COMMERCIAL_STATES = {
  freePreflight: { state: 'available-free', path: '/tools/evidence-preflight', priceUsd: 0 },
  boundedDossier: { state: 'informational-purchase-disabled', path: '/tools/evidence-preflight#future-offer', proposedPriceUsd: EVIDENCE_PREFLIGHT_PRICE_USD, purchaseEnabled: false },
  developerEvidenceRetrieval: { state: 'private-engagement', path: '/contact', monthlyListPriceUsd: MCP_EVIDENCE_LICENSE_PLANS['evidence-developer-v1'].listPriceUsdCents / 100, publicRuntimeAvailable: false },
} as const

export const EVIDENCE_WORKFLOW_PUBLIC_REGISTRY = {
  schemaVersion: EVIDENCE_WORKFLOW_VERSION,
  preparedOn: EVIDENCE_WORKFLOW_DATE,
  status: 'prepared-not-deployed',
  syntheticOnly: true,
  purchaseEnabled: false,
  purpose: 'Worked public examples connecting structural preflight, Evidence Dossiers, deterministic receipts, canonical release, entitlement, licensed retrieval, delivery, and acknowledgement.',
  boundary: 'Examples demonstrate protocol behavior with synthetic material. They contain no customer submissions, private corpus passages, credentials, release authority, or live purchase capability.',
  counts: {
    examples: EVIDENCE_WORKFLOW_EXAMPLES.length,
    categories: Object.fromEntries(EVIDENCE_WORKFLOW_CATEGORIES.map((category) => [category, EVIDENCE_WORKFLOW_EXAMPLES.filter((workflow) => workflow.category === category).length])),
  },
  commercialStates: EVIDENCE_WORKFLOW_COMMERCIAL_STATES,
  cohortSha256: provenanceDigest(cohort),
  examples: EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => ({ ...workflow, path: evidenceWorkflowPath(workflow) })),
} as const

export const EVIDENCE_WORKFLOW_REGISTRY_DIGEST = provenanceDigest(EVIDENCE_WORKFLOW_PUBLIC_REGISTRY)

function assertEvidenceWorkflows(): void {
  const frozen = cohort.exampleSlugs as string[]
  if (!cohort.frozen || !cohort.syntheticOnly || cohort.purchaseEnabled || cohort.publicNow || cohort.vercelBuildAuthorized) throw new Error('Evidence workflow cohort boundaries changed.')
  if (frozen.length !== 20 || EVIDENCE_WORKFLOW_EXAMPLES.length !== 20 || new Set(frozen).size !== 20) throw new Error('Evidence workflow cohort must remain frozen at 20 unique examples.')
  if (frozen.join('|') !== EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => workflow.slug).join('|')) throw new Error('Evidence workflow cohort identity changed.')
  for (const category of EVIDENCE_WORKFLOW_CATEGORIES) {
    if (EVIDENCE_WORKFLOW_EXAMPLES.filter((workflow) => workflow.category === category).length !== cohort.categories[category]) throw new Error(`Evidence workflow category changed: ${category}.`)
  }
  if (EVIDENCE_WORKFLOW_QUALITY.some((quality) => !quality.eligible)) throw new Error(`Ineligible evidence workflows: ${JSON.stringify(EVIDENCE_WORKFLOW_QUALITY.filter((quality) => !quality.eligible))}`)
  if (EVIDENCE_WORKFLOW_EXAMPLES.some((workflow) => workflow.commercialNextStep.state === 'informational-purchase-disabled' && workflow.commercialNextStep.path !== '/tools/evidence-preflight#future-offer')) throw new Error('Disabled dossier offers must resolve to the published informational contract.')
}

assertEvidenceWorkflows()
