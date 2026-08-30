import { sha256Canonical } from './epistemic-publication.ts'
import {
  ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES,
  ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
  compilePrivateBatch9OverrideCandidate,
} from './frontier-alignment-batch-9-review.ts'
import {
  ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES,
  ALIGNMENT_BATCH_10_REVIEW_DECISIONS,
  compilePrivateBatch10OverrideCandidate,
} from './frontier-alignment-batch-10-review.ts'

export const SOURCE_OVERRIDE_ACTIVATION_VERSION = 'maha-source-override-activation/0.1' as const

type AcceptedCandidate =
  | (typeof ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES)[number]
  | (typeof ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES)[number]

export interface PrivateSourceOverrideActivation {
  schemaVersion: typeof SOURCE_OVERRIDE_ACTIVATION_VERSION
  activationId: string
  batch: 9 | 10
  recordId: string
  priorRecordRevisionSha256: string
  priorSourceContractId: string
  proposedSourceContractId: string
  proposedSourceIdentifier: string
  exactLocator: string
  claimIds: readonly string[]
  reviewDecisionId: string
  reviewDecisionSha256: string
  packetContentSha256: string
  candidateRevisionSha256: string
  candidateProvenanceSha256: string
  disposition: 'private-revision-ready'
  remainingRequirements: readonly [
    'construct-full-record-revision',
    'run-revision-alignment-audit',
    'issue-revision-scoped-release-decisions',
    'canonical-rerelease',
  ]
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  externallyReviewed: false
  independentlyReproduced: false
  activationSha256: string
}

export interface PrivateSourceOverrideCanaryEnvelope {
  schemaVersion: 'maha-source-override-canary/0.1'
  canaryId: string
  recordId: string
  activationSha256: string
  candidateRevisionSha256: string
  candidateProvenanceSha256: string
  state: 'verified-private-only'
  activeBindingChanged: false
  canonicalMutationAuthorized: false
  publicProjectionAuthorized: false
  releaseAuthorized: false
  envelopeSha256: string
}

const accepted = [
  ...ALIGNMENT_BATCH_9_ACCEPTED_CANDIDATES.map((candidate) => ({ batch: 9 as const, candidate })),
  ...ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES.map((candidate) => ({ batch: 10 as const, candidate })),
]

function candidateFor(batch: 9 | 10, recordId: string): AcceptedCandidate {
  return batch === 9
    ? compilePrivateBatch9OverrideCandidate(recordId)
    : compilePrivateBatch10OverrideCandidate(recordId)
}

function activationFor(batch: 9 | 10, candidate: AcceptedCandidate): PrivateSourceOverrideActivation {
  const recomputed = candidateFor(batch, candidate.recordId)
  if (sha256Canonical(recomputed) !== sha256Canonical(candidate)) {
    throw new Error(`${candidate.recordId}: accepted source-override candidate is stale or tampered.`)
  }
  const base = {
    schemaVersion: SOURCE_OVERRIDE_ACTIVATION_VERSION,
    activationId: `urn:maha:activation:frontier-source-override:${candidate.recordId.replace('urn:maha:record:', '')}:batch-${batch}`,
    batch,
    recordId: candidate.recordId,
    priorRecordRevisionSha256: candidate.priorRecordRevisionSha256,
    priorSourceContractId: candidate.priorSourceContractId,
    proposedSourceContractId: candidate.proposedSourceContractId,
    proposedSourceIdentifier: candidate.proposedSourceIdentifier,
    exactLocator: candidate.exactLocator,
    claimIds: candidate.claimIds,
    reviewDecisionId: candidate.reviewDecisionId,
    reviewDecisionSha256: candidate.reviewDecisionSha256,
    packetContentSha256: candidate.packetContentSha256,
    candidateRevisionSha256: candidate.candidateRevisionSha256,
    candidateProvenanceSha256: candidate.provenanceSha256,
    disposition: 'private-revision-ready' as const,
    remainingRequirements: [
      'construct-full-record-revision',
      'run-revision-alignment-audit',
      'issue-revision-scoped-release-decisions',
      'canonical-rerelease',
    ] as const,
    canonicalMutationAuthorized: false as const,
    publicProjectionAuthorized: false as const,
    releaseAuthorized: false as const,
    externallyReviewed: false as const,
    independentlyReproduced: false as const,
  }
  return { ...base, activationSha256: sha256Canonical(base) }
}

export const PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS: readonly PrivateSourceOverrideActivation[] = accepted
  .map(({ batch, candidate }) => activationFor(batch, candidate))
  .sort((left, right) => left.recordId < right.recordId ? -1 : left.recordId > right.recordId ? 1 : 0)

export const SOURCE_OVERRIDE_REVISE_RECORD_IDS = [
  ...ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
  ...ALIGNMENT_BATCH_10_REVIEW_DECISIONS,
].filter((decision) => decision.decision === 'revise').map((decision) => decision.recordId).sort()

export const SOURCE_OVERRIDE_REJECT_RECORD_IDS = [
  ...ALIGNMENT_BATCH_9_REVIEW_DECISIONS,
  ...ALIGNMENT_BATCH_10_REVIEW_DECISIONS,
].filter((decision) => decision.decision === 'reject').map((decision) => decision.recordId).sort()

export const PRIVATE_SOURCE_OVERRIDE_CANARY_RECORD_IDS = [
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
  'urn:maha:record:advanced-materials-direct-gap-mos2',
  'urn:maha:record:neurotechnology-bci-light-delivery-tissue-heating',
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering',
] as const

function canaryFor(activation: PrivateSourceOverrideActivation): PrivateSourceOverrideCanaryEnvelope {
  const verified = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === activation.recordId)
  if (!verified || verified.activationSha256 !== activation.activationSha256) {
    throw new Error(`${activation.recordId}: source-override activation is stale or unverified.`)
  }
  const base = {
    schemaVersion: 'maha-source-override-canary/0.1' as const,
    canaryId: `urn:maha:canary:frontier-source-override:${activation.recordId.replace('urn:maha:record:', '')}`,
    recordId: activation.recordId,
    activationSha256: activation.activationSha256,
    candidateRevisionSha256: activation.candidateRevisionSha256,
    candidateProvenanceSha256: activation.candidateProvenanceSha256,
    state: 'verified-private-only' as const,
    activeBindingChanged: false as const,
    canonicalMutationAuthorized: false as const,
    publicProjectionAuthorized: false as const,
    releaseAuthorized: false as const,
  }
  return { ...base, envelopeSha256: sha256Canonical(base) }
}

export const PRIVATE_SOURCE_OVERRIDE_CANARY: readonly PrivateSourceOverrideCanaryEnvelope[] =
  PRIVATE_SOURCE_OVERRIDE_CANARY_RECORD_IDS.map((recordId) => {
    const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === recordId)
    if (!activation) throw new Error(`${recordId}: private canary selection is not accepted.`)
    return canaryFor(activation)
  })

function assertIntegrity(): void {
  if (PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.length !== 26
    || SOURCE_OVERRIDE_REVISE_RECORD_IDS.length !== 13
    || SOURCE_OVERRIDE_REJECT_RECORD_IDS.length !== 1) {
    throw new Error('Source-override activation decision totals drifted.')
  }
  if (PRIVATE_SOURCE_OVERRIDE_CANARY.length !== 5
    || new Set(PRIVATE_SOURCE_OVERRIDE_CANARY.map((entry) => entry.recordId)).size !== 5) {
    throw new Error('Private source-override canary must contain five unique accepted records.')
  }
  const forbidden = new Set([...SOURCE_OVERRIDE_REVISE_RECORD_IDS, ...SOURCE_OVERRIDE_REJECT_RECORD_IDS])
  if (PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.some((entry) => forbidden.has(entry.recordId))) {
    throw new Error('A revised or rejected source proposal entered activation.')
  }
  if (PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.some((entry) => entry.canonicalMutationAuthorized
    || entry.publicProjectionAuthorized || entry.releaseAuthorized || entry.externallyReviewed
    || entry.independentlyReproduced)) {
    throw new Error('Private activation crossed a governance boundary.')
  }
}

assertIntegrity()
