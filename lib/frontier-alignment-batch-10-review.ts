import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_10_REMEDIATION_PACKETS } from './frontier-alignment-batch-10.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { alignmentFor } from './frontier-source-alignment.ts'

export const ALIGNMENT_BATCH_10_REVIEW_VERSION = 'maha-frontier-alignment-batch/10.1' as const
export const ALIGNMENT_BATCH_10_CANARY_VERSION = 'maha-frontier-source-override-canary/0.2' as const

export const BATCH_10_REVIEW_DECISIONS = ['accept', 'revise', 'reject'] as const
export type Batch10ReviewDecisionKind = (typeof BATCH_10_REVIEW_DECISIONS)[number]

export const BATCH_10_VERSION_RELATIONSHIPS = [
  'exact-version-of-record',
  'verified-related-prepublication-manuscript',
  'exact-versioned-preprint',
  'exact-authoritative-artifact',
  'exact-government-artifact',
  'exact-patent-publication',
] as const
export type Batch10VersionRelationship = (typeof BATCH_10_VERSION_RELATIONSHIPS)[number]
export type Batch10ClaimScopeFinding = 'supports-exact-bounded-claim' | 'record-revision-required' | 'does-not-support-claim'

interface Batch10DecisionInput {
  decision: Batch10ReviewDecisionKind
  versionRelationship: Batch10VersionRelationship
  claimScopeFinding: Batch10ClaimScopeFinding
  rationale: string
  requiredAction: string
}

export interface Batch10ReviewDecision {
  schemaVersion: typeof ALIGNMENT_BATCH_10_REVIEW_VERSION
  decisionId: string
  packetId: string
  packetContentSha256: string
  recordId: string
  activeRecordRevisionSha256: string
  activeSourceContractId: string
  proposedSourceContractId: string
  proposedSourceIdentifier: string
  decision: Batch10ReviewDecisionKind
  review: {
    reviewerId: 'maha-internal-editorial:batch-10-second-pass'
    reviewerKind: 'internal-editorial'
    reviewPass: 'separate-second-pass'
    reviewedAt: '2026-08-30'
    externallyReviewed: false
    independentlyReproduced: false
  }
  checks: {
    sourceIdentity: 'verified'
    sourceIdentityFinding: string
    versionRelationship: Batch10VersionRelationship
    versionRelationshipFinding: string
    rightsBasis: 'citation-with-paraphrase-only'
    rightsFinding: string
    contentInspected: true
    exactLocatorInspected: true
    locatorFinding: string
    claimScope: Batch10ClaimScopeFinding
  }
  rationale: string
  requiredAction: string
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  decisionSha256: string
}

export interface Batch10PrivateOverrideCandidate {
  schemaVersion: typeof ALIGNMENT_BATCH_10_CANARY_VERSION
  candidateId: string
  recordId: string
  priorRecordRevisionSha256: string
  priorSourceContractId: string
  proposedSourceContractId: string
  proposedSourceIdentifier: string
  proposedCitation: string
  proposedUrl: string
  exactLocator: string
  boundedFinding: string
  limitation: string
  claimIds: readonly string[]
  reviewDecisionId: string
  reviewDecisionSha256: string
  packetContentSha256: string
  applicationState: 'private-candidate-only'
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  candidateRevisionSha256: string
  provenanceSha256: string
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const DECISION_INPUTS: Readonly<Record<string, Batch10DecisionInput>> = {
  'urn:maha:record:advanced-materials-moire-superlattices': {
    decision: 'revise', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'record-revision-required',
    rationale: 'The inspected paper is a continuum-model study. It supports a theoretical-model or concept record, not the active record’s measurement classification.',
    requiredAction: 'Revise recordKind and claimKind to model or concept before adopting the source; preserve the twist-angle and material-system limits.',
  },
  'urn:maha:record:advanced-materials-twist-angle-control': {
    decision: 'revise', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'record-revision-required',
    rationale: 'The source directly supports an experimental twist-control method, but it does not provide the two supported sides required by a comparison record.',
    requiredAction: 'Revise recordKind to method and restrict the claim to the reported in-situ manipulation and aligned graphene/hBN devices.',
  },
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens': {
    decision: 'accept', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The inspected Macaroons paper directly supports caveat-bound bearer credentials as a least-authority token concept.',
    requiredAction: 'Adopt only as a private candidate and retain the limitation that the design does not prove every deployment secure.',
  },
  'urn:maha:record:agentic-systems-mcp-sandboxed-tool-execution': {
    decision: 'accept', versionRelationship: 'exact-versioned-preprint', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The versioned preprint directly describes a WASM/WASI sandbox mechanism and bounded case-study observations.',
    requiredAction: 'Label the source as a preprint and prohibit claims of complete isolation, universal threat coverage, or production readiness.',
  },
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering': {
    decision: 'accept', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The article directly supports the stated engineering method through perturbation, rate modelling, parameter estimation, and optimization of a ten-enzyme cascade.',
    requiredAction: 'Keep the claim bounded to the constructed in-vitro cascade and reported optimization conditions.',
  },
  'urn:maha:record:critical-supply-chains-semiconductor-grade-polysilicon': {
    decision: 'revise', versionRelationship: 'exact-government-artifact', claimScopeFinding: 'record-revision-required',
    rationale: 'The historical report supports semiconductor-grade polysilicon processes and supply context, but the generated record treats the material itself as a method.',
    requiredAction: 'Revise the record to a concept or define a named refining/deposition method; preserve the 1984 chronology and prohibit current-market inference.',
  },
  'urn:maha:record:critical-supply-chains-fluorinated-resist-components': {
    decision: 'accept', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The article directly supports fluorinated resist components as a bounded materials concept through one zinc-oxocluster family.',
    requiredAction: 'Do not widen one material family into a complete commercial supply-chain or all-resist performance claim.',
  },
  'urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing': {
    decision: 'accept', versionRelationship: 'exact-patent-publication', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The patent directly discloses the named crucible-forming mechanism and manufacturing steps.',
    requiredAction: 'Identify the evidence as a patent disclosure, not independent proof of yield, adoption, or comparative superiority.',
  },
  'urn:maha:record:fusion-plasma-systems-magnetic-mirror-confinement': {
    decision: 'accept', versionRelationship: 'exact-government-artifact', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The LLNL report directly supports magnetic-mirror confinement as a bounded open-field confinement concept with historical observations.',
    requiredAction: 'Keep the historical experiment and planned-program boundaries; do not infer modern plant feasibility.',
  },
  'urn:maha:record:fusion-plasma-systems-plasma-position-and-shape-control': {
    decision: 'accept', versionRelationship: 'exact-authoritative-artifact', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The official ITER topical page directly identifies plasma current, position, and shape as magnetic-control targets.',
    requiredAction: 'Record the living-page status and avoid inventing one controller result, uncertainty interval, or universal control law.',
  },
  'urn:maha:record:mechanistic-interpretability-circuit-completeness': {
    decision: 'accept', versionRelationship: 'exact-versioned-preprint', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The inspected paper explicitly evaluates an IOI circuit using faithfulness, completeness, and minimality criteria.',
    requiredAction: 'Keep the GPT-2-small, task, prompt-distribution, and documented-gap boundaries explicit.',
  },
  'urn:maha:record:advanced-materials-tmd-monolayers': {
    decision: 'revise', versionRelationship: 'verified-related-prepublication-manuscript', claimScopeFinding: 'record-revision-required',
    rationale: 'The source supports an optical measurement of layer-dependent MoS2 electronic structure, not a method for making TMD monolayers.',
    requiredAction: 'Revise the record to measurement or concept and retain the MoS2, layer-count, and spectroscopy limits.',
  },
  'urn:maha:record:advanced-materials-topological-insulator-surface-states': {
    decision: 'revise', versionRelationship: 'verified-related-prepublication-manuscript', claimScopeFinding: 'record-revision-required',
    rationale: 'The colloquium supports surface states as a theoretical and experimental concept, while the generated record classifies them as a method.',
    requiredAction: 'Revise recordKind to concept and distinguish review synthesis from a single empirical result.',
  },
  'urn:maha:record:advanced-materials-contact-resistance-in-2d-devices': {
    decision: 'accept', versionRelationship: 'exact-version-of-record', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The review directly supports contact resistance as a bounded 2D-device concept and identifies the stated physical and interface factors.',
    requiredAction: 'Do not infer a universal resistance value or validated performance for every contact stack.',
  },
  'urn:maha:record:fusion-plasma-systems-electron-cyclotron-heating': {
    decision: 'revise', versionRelationship: 'exact-authoritative-artifact', claimScopeFinding: 'record-revision-required',
    rationale: 'The official ITER page supports the ECRH mechanism and planned system, but it contains no bounded two-sided comparison.',
    requiredAction: 'Revise recordKind to mechanism or supply an independently supported comparison axis and both sides.',
  },
  'urn:maha:record:fusion-plasma-systems-neutral-beam-injection': {
    decision: 'revise', versionRelationship: 'exact-authoritative-artifact', claimScopeFinding: 'record-revision-required',
    rationale: 'The official ITER page describes the planned NBI mechanism; it is not a measurement of realized ITER plasma performance.',
    requiredAction: 'Revise recordKind to mechanism and keep design values separate from measured outcomes.',
  },
  'urn:maha:record:fusion-plasma-systems-edge-localized-modes': {
    decision: 'accept', versionRelationship: 'exact-versioned-preprint', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The multi-device preprint supports a bounded measurement record through reported RMP-ELM suppression observations and operating windows.',
    requiredAction: 'Label the source as a preprint and restrict the record to the observed suppression regime and named devices.',
  },
  'urn:maha:record:mechanistic-interpretability-cross-layer-transcoders': {
    decision: 'accept', versionRelationship: 'exact-authoritative-artifact', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The author-hosted methods article defines CLTs and evaluates replacement models and attribution graphs, supporting the bounded comparison record.',
    requiredAction: 'Retain reconstruction error, missing mechanisms, living-page status, and non-completeness limitations.',
  },
  'urn:maha:record:mechanistic-interpretability-io-identification-circuit': {
    decision: 'revise', versionRelationship: 'exact-versioned-preprint', claimScopeFinding: 'record-revision-required',
    rationale: 'The paper supports a model- and task-specific circuit explanation and interventions, but the generated record supplies no two-sided comparison.',
    requiredAction: 'Revise recordKind to concept or method unless a bounded comparison and both supported sides are added.',
  },
  'urn:maha:record:agentic-systems-mcp-tool-result-context-injection': {
    decision: 'accept', versionRelationship: 'exact-versioned-preprint', claimScopeFinding: 'supports-exact-bounded-claim',
    rationale: 'The InjecAgent preprint supplies a bounded benchmark comparison across tools and attack categories for indirect context injection.',
    requiredAction: 'Keep the preprint and benchmark scope explicit; do not infer universal MCP vulnerability or universal mitigation efficacy.',
  },
}

function relationshipFinding(relationship: Batch10VersionRelationship): string {
  switch (relationship) {
    case 'exact-version-of-record': return 'The inspected artifact is the identified published version of record.'
    case 'verified-related-prepublication-manuscript': return 'The inspected prepublication manuscript is explicitly related to the identified published work and is not represented as the publisher copy.'
    case 'exact-versioned-preprint': return 'The inspected artifact is the exact versioned preprint named by the packet; no version-of-record status is asserted.'
    case 'exact-authoritative-artifact': return 'The inspected artifact is the exact official or author-hosted living technical page named by the packet; its living status is retained.'
    case 'exact-government-artifact': return 'The inspected artifact is the exact government repository report named by the packet.'
    case 'exact-patent-publication': return 'The inspected artifact is the exact published patent named by the packet and is treated as disclosure rather than independent validation.'
  }
}

function decisionWithoutDigest(recordId: string, input: Batch10DecisionInput): Omit<Batch10ReviewDecision, 'decisionSha256'> {
  const packet = ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.find((entry) => entry.recordId === recordId)
  const active = alignmentFor(recordId)
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  if (!packet || !active || !record) throw new Error(`${recordId}: Batch 10 review target is missing.`)
  return {
    schemaVersion: ALIGNMENT_BATCH_10_REVIEW_VERSION,
    decisionId: `urn:maha:review:frontier-alignment-batch-10:${record.slug}`,
    packetId: packet.packetId,
    packetContentSha256: sha256(packet),
    recordId,
    activeRecordRevisionSha256: epistemicReviewTargetHash(record),
    activeSourceContractId: active.sourceContractId,
    proposedSourceContractId: packet.replacement.proposedSourceContractId,
    proposedSourceIdentifier: packet.replacement.identifier,
    decision: input.decision,
    review: {
      reviewerId: 'maha-internal-editorial:batch-10-second-pass', reviewerKind: 'internal-editorial',
      reviewPass: 'separate-second-pass', reviewedAt: '2026-08-30', externallyReviewed: false, independentlyReproduced: false,
    },
    checks: {
      sourceIdentity: 'verified',
      sourceIdentityFinding: `Identity rechecked against ${packet.replacement.identifier}. ${packet.replacement.inspection.metadataNote}`,
      versionRelationship: input.versionRelationship,
      versionRelationshipFinding: relationshipFinding(input.versionRelationship),
      rightsBasis: 'citation-with-paraphrase-only',
      rightsFinding: 'The candidate stores citation metadata and original bounded paraphrase only; no source text, figure, table, or executable artifact is committed.',
      contentInspected: true,
      exactLocatorInspected: true,
      locatorFinding: `${packet.replacement.inspection.inspectedContentLocation} ${packet.replacement.inspection.findings}`,
      claimScope: input.claimScopeFinding,
    },
    rationale: input.rationale,
    requiredAction: input.requiredAction,
    canonicalMutationAuthorized: false,
    publicProjectionAuthorized: false,
    releaseAuthorized: false,
  }
}

export const ALIGNMENT_BATCH_10_REVIEW_DECISIONS: readonly Batch10ReviewDecision[] = Object.entries(DECISION_INPUTS)
  .map(([recordId, input]) => {
    const base = decisionWithoutDigest(recordId, input)
    return { ...base, decisionSha256: sha256(base) }
  })
  .sort((a, b) => a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0)

export const ALIGNMENT_BATCH_10_CANARY_RECORD_IDS = [
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering',
  'urn:maha:record:critical-supply-chains-fluorinated-resist-components',
  'urn:maha:record:fusion-plasma-systems-magnetic-mirror-confinement',
  'urn:maha:record:mechanistic-interpretability-circuit-completeness',
] as const

export function compilePrivateBatch10OverrideCandidate(
  recordId: string,
  decisions: readonly Batch10ReviewDecision[] = ALIGNMENT_BATCH_10_REVIEW_DECISIONS,
): Batch10PrivateOverrideCandidate {
  const packet = ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.find((entry) => entry.recordId === recordId)
  const active = alignmentFor(recordId)
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  const decision = decisions.find((entry) => entry.recordId === recordId)
  if (!packet || !active || !record) throw new Error(`${recordId}: source-override target is missing.`)
  if (!decision) throw new Error(`${recordId}: source-override-review-missing`)

  const { decisionSha256, ...withoutDigest } = decision
  if (sha256(withoutDigest) !== decisionSha256) throw new Error(`${recordId}: source-override-review-digest-invalid`)
  if (decision.packetContentSha256 !== sha256(packet)
    || decision.packetId !== packet.packetId
    || decision.proposedSourceContractId !== packet.replacement.proposedSourceContractId
    || decision.proposedSourceIdentifier !== packet.replacement.identifier) {
    throw new Error(`${recordId}: source-override-review-packet-mismatch`)
  }
  if (decision.activeRecordRevisionSha256 !== epistemicReviewTargetHash(record)
    || decision.activeSourceContractId !== active.sourceContractId
    || active.evidence.subjectAligned !== 'mismatched') {
    throw new Error(`${recordId}: source-override-review-stale`)
  }
  if (decision.decision === 'reject') throw new Error(`${recordId}: source-override-review-rejected`)
  if (decision.decision === 'revise') throw new Error(`${recordId}: source-override-record-revision-required`)
  if (decision.checks.claimScope !== 'supports-exact-bounded-claim'
    || !decision.checks.contentInspected || !decision.checks.exactLocatorInspected
    || decision.checks.sourceIdentity !== 'verified'
    || decision.canonicalMutationAuthorized || decision.publicProjectionAuthorized || decision.releaseAuthorized) {
    throw new Error(`${recordId}: source-override-review-not-eligible`)
  }

  const base = {
    schemaVersion: ALIGNMENT_BATCH_10_CANARY_VERSION,
    candidateId: `urn:maha:candidate:frontier-source-override:${record.slug}:batch-10`,
    recordId,
    priorRecordRevisionSha256: epistemicReviewTargetHash(record),
    priorSourceContractId: active.sourceContractId,
    proposedSourceContractId: packet.replacement.proposedSourceContractId,
    proposedSourceIdentifier: packet.replacement.identifier,
    proposedCitation: packet.replacement.citation,
    proposedUrl: packet.replacement.url,
    exactLocator: packet.replacement.inspection.inspectedContentLocation,
    boundedFinding: packet.replacement.inspection.findings,
    limitation: packet.replacement.inspection.limitation,
    claimIds: record.claims.map((claim) => claim.id),
    reviewDecisionId: decision.decisionId,
    reviewDecisionSha256: decision.decisionSha256,
    packetContentSha256: decision.packetContentSha256,
    applicationState: 'private-candidate-only' as const,
    canonicalMutationAuthorized: false as const,
    publicProjectionAuthorized: false as const,
    releaseAuthorized: false as const,
  }
  const candidateRevisionSha256 = sha256(base)
  return {
    ...base,
    candidateRevisionSha256,
    provenanceSha256: sha256({
      candidateRevisionSha256,
      packetContentSha256: decision.packetContentSha256,
      reviewDecisionSha256: decision.decisionSha256,
      priorRecordRevisionSha256: epistemicReviewTargetHash(record),
    }),
  }
}

export const ALIGNMENT_BATCH_10_PRIVATE_CANARY: readonly Batch10PrivateOverrideCandidate[] =
  ALIGNMENT_BATCH_10_CANARY_RECORD_IDS.map((recordId) => compilePrivateBatch10OverrideCandidate(recordId))

export const ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES: readonly Batch10PrivateOverrideCandidate[] =
  ALIGNMENT_BATCH_10_REVIEW_DECISIONS
    .filter((decision) => decision.decision === 'accept')
    .map((decision) => compilePrivateBatch10OverrideCandidate(decision.recordId))

function assertBatch10ReviewIntegrity(): void {
  if (ALIGNMENT_BATCH_10_REVIEW_DECISIONS.length !== 20
    || new Set(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.recordId)).size !== 20
    || new Set(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.decisionId)).size !== 20
    || Object.keys(DECISION_INPUTS).length !== ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.length) {
    throw new Error('Batch 10 must contain one unique append-only review decision per packet.')
  }
  for (const decision of ALIGNMENT_BATCH_10_REVIEW_DECISIONS) {
    const packet = ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.find((entry) => entry.recordId === decision.recordId)
    const active = alignmentFor(decision.recordId)
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === decision.recordId)
    if (!packet || !active || !record) throw new Error(`${decision.recordId}: Batch 10 review input is missing.`)
    if (decision.packetContentSha256 !== sha256(packet)
      || decision.activeRecordRevisionSha256 !== epistemicReviewTargetHash(record)
      || decision.activeSourceContractId !== active.sourceContractId) {
      throw new Error(`${decision.recordId}: Batch 10 review is stale or unbound.`)
    }
    const { decisionSha256, ...withoutDigest } = decision
    if (decisionSha256 !== sha256(withoutDigest)) throw new Error(`${decision.recordId}: Batch 10 decision digest is invalid.`)
    if (decision.review.externallyReviewed || decision.review.independentlyReproduced
      || decision.canonicalMutationAuthorized || decision.publicProjectionAuthorized || decision.releaseAuthorized) {
      throw new Error(`${decision.recordId}: Batch 10 review crossed a governance boundary.`)
    }
    if (decision.decision === 'accept' && decision.checks.claimScope !== 'supports-exact-bounded-claim') {
      throw new Error(`${decision.recordId}: Batch 10 accepted a claim requiring revision.`)
    }
    if (decision.decision === 'revise' && decision.checks.claimScope !== 'record-revision-required') {
      throw new Error(`${decision.recordId}: Batch 10 revision lacks a record-scope finding.`)
    }
    if (decision.decision === 'reject' && decision.checks.claimScope !== 'does-not-support-claim') {
      throw new Error(`${decision.recordId}: Batch 10 rejected a source without a claim-scope finding.`)
    }
  }
  if (ALIGNMENT_BATCH_10_PRIVATE_CANARY.length !== 5
    || new Set(ALIGNMENT_BATCH_10_PRIVATE_CANARY.map((entry) => entry.recordId)).size !== 5
    || ALIGNMENT_BATCH_10_PRIVATE_CANARY.some((entry) => entry.applicationState !== 'private-candidate-only')) {
    throw new Error('Batch 10 private canary is invalid.')
  }
  const acceptedCount = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.filter((entry) => entry.decision === 'accept').length
  if (ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES.length !== acceptedCount
    || ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES.some((entry) => entry.applicationState !== 'private-candidate-only')) {
    throw new Error('Batch 10 accepted candidate revisions are incomplete or crossed their private boundary.')
  }
}

assertBatch10ReviewIntegrity()
