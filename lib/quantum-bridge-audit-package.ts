import { createHash } from 'node:crypto'

import {
  BRIDGE_SPECIFICATION_VERSION,
  QUANTUM_BRIDGE_CANDIDATES,
  projectCandidateClassification,
  type BridgeCandidate,
  type CandidateClassification,
} from './quantum-bridge-candidates.ts'
import {
  REFERENCE_RESOLVER_VERSION,
  isResolvedOutcome,
  namespaceInventory,
  resolveEpistemicReference,
  type ResolutionResult,
} from './epistemic-reference-resolver.ts'

/**
 * The durable audit view of the Q-BR batch.
 *
 * Endpoint resolution is computed here by the shared resolver, never stored on
 * a record, so a corpus change moves every candidate at once and no batch can
 * carry its own private idea of what resolves.
 *
 * The submitted proposal and the audit are kept side by side. Incorrect
 * submitted metadata is never overwritten: a correction is stored next to the
 * original so a reviewer can see both.
 */

export const AUDIT_PACKAGE_VERSION = 'maha-bridge-audit/1.0' as const

/** Machine-readable reasons a candidate cannot be promoted. */
export const BLOCKER_CODES = [
  'endpoint-unresolved-domain',
  'endpoint-unresolved-record',
  'endpoint-ambiguous',
  'endpoint-incompatible-record-class',
  'source-unverifiable',
  'source-missing-identifier',
  'source-missing-locator',
  'rights-basis-unverified',
  'claim-strength-rejected',
  'classification-unmappable',
] as const

export type BlockerCode = (typeof BLOCKER_CODES)[number]

export interface AuditedBridge {
  id: string
  /** Verbatim, as submitted. Never rewritten by the resolver or the audit. */
  submitted: {
    title: string
    classification: CandidateClassification
    sourceReference: string
    targetReference: string
    citations: readonly string[]
  }
  audited: {
    mechanism: string
    establishes: string
    doesNotEstablish: string
    classificationRationale: string
    wordingCorrections: readonly string[]
    prohibitedInferences: readonly string[]
    classificationProjection: ReturnType<typeof projectCandidateClassification>
  }
  endpoints: {
    source: ResolutionResult
    target: ResolutionResult
  }
  verdict: BridgeCandidate['verdict']
  verdictRationale: string
  blockerCodes: readonly BlockerCode[]
  promotionEligible: false
  provenance: {
    auditPackageVersion: typeof AUDIT_PACKAGE_VERSION
    bridgeSpecificationVersion: typeof BRIDGE_SPECIFICATION_VERSION
    resolverVersion: typeof REFERENCE_RESOLVER_VERSION
  }
  auditDigest: string
}

function endpointBlockers(result: ResolutionResult): BlockerCode[] {
  switch (result.outcome.status) {
    case 'exact-resolution':
    case 'alias-resolution':
      return []
    case 'unresolved-domain':
      return ['endpoint-unresolved-domain']
    case 'unresolved-record':
      return ['endpoint-unresolved-record']
    case 'ambiguous':
      return ['endpoint-ambiguous']
    case 'incompatible-record-class':
      return ['endpoint-incompatible-record-class']
  }
}

function sourceBlockers(candidate: BridgeCandidate): BlockerCode[] {
  const codes = new Set<BlockerCode>()
  for (const source of candidate.sources) {
    if (source.verification === 'unverifiable') codes.add('source-unverifiable')
    if (!source.identifier) codes.add('source-missing-identifier')
    if (!source.locator) codes.add('source-missing-locator')
    if (source.rejectedAssertion) codes.add('claim-strength-rejected')
  }
  if (candidate.rightsBasis === 'unverified') codes.add('rights-basis-unverified')
  return [...codes]
}

function auditBridge(candidate: BridgeCandidate): AuditedBridge {
  const source = resolveEpistemicReference(candidate.declaredSourceRef)
  const target = resolveEpistemicReference(candidate.declaredTargetRef)
  const projection = projectCandidateClassification(candidate.classification)

  const blockerCodes = [
    ...new Set<BlockerCode>([
      ...endpointBlockers(source),
      ...endpointBlockers(target),
      ...sourceBlockers(candidate),
      ...(projection.mappable ? [] : (['classification-unmappable'] as BlockerCode[])),
    ]),
  ].sort()

  const audited: AuditedBridge = {
    id: candidate.id,
    submitted: {
      title: candidate.title,
      classification: candidate.classification,
      sourceReference: candidate.declaredSourceRef,
      targetReference: candidate.declaredTargetRef,
      citations: candidate.sources.map((entry) => entry.citation),
    },
    audited: {
      mechanism: candidate.mechanism,
      establishes: candidate.establishes,
      doesNotEstablish: candidate.doesNotEstablish,
      classificationRationale: candidate.classificationRationale,
      wordingCorrections: candidate.wordingCorrections,
      prohibitedInferences: candidate.prohibitedInferences,
      classificationProjection: projection,
    },
    endpoints: { source, target },
    verdict: candidate.verdict,
    verdictRationale: candidate.verdictRationale,
    blockerCodes,
    promotionEligible: false,
    provenance: {
      auditPackageVersion: AUDIT_PACKAGE_VERSION,
      bridgeSpecificationVersion: BRIDGE_SPECIFICATION_VERSION,
      resolverVersion: REFERENCE_RESOLVER_VERSION,
    },
    auditDigest: '',
  }

  // Digest covers everything except the digest field itself.
  const digestable = { ...audited, auditDigest: undefined }
  audited.auditDigest = `sha256:${createHash('sha256').update(JSON.stringify(digestable)).digest('hex')}`
  return audited
}

export const QUANTUM_BRIDGE_AUDIT: readonly AuditedBridge[] = QUANTUM_BRIDGE_CANDIDATES.map(auditBridge)

/**
 * A candidate may only be enqueued for review or promotion with zero blockers.
 * This is the single gate; there is no bespoke publication path for bridges.
 */
export function isPromotionEligible(bridge: AuditedBridge): boolean {
  return bridge.blockerCodes.length === 0 && bridge.verdict === 'ACCEPT'
}

export function promotionReadyBridges(): readonly AuditedBridge[] {
  return QUANTUM_BRIDGE_AUDIT.filter(isPromotionEligible)
}

/* ----------------------------------------------------------- gap report -- */

export interface GapReport {
  auditPackageVersion: typeof AUDIT_PACKAGE_VERSION
  resolverVersion: typeof REFERENCE_RESOLVER_VERSION
  endpointTotals: Record<string, number>
  sourceTotals: Record<string, number>
  verdictTotals: Record<string, number>
  blockerTotals: Record<string, number>
  /** Blocked only by things a corpus or bibliography change could fix. */
  remediableToRevise: readonly { id: string; remediation: string }[]
  /** Blocked by something no amount of record creation repairs. */
  conceptuallyInvalid: readonly { id: string; reason: string }[]
  namespaces: ReturnType<typeof namespaceInventory>
}

/**
 * Candidates whose blockers are all structural (missing records, missing
 * locators) could reach REVIEW after specific remediation. Candidates carrying
 * a rejected claim or an unverifiable source cannot, because the defect is the
 * claim or the citation itself.
 */
const CONCEPTUAL_DEFECTS: Record<string, string> = {
  'Q-BR-003':
    'The submitted bridge asserts an isomorphism between Schmidt-rank truncation and sparse dictionary learning. The objectives differ (entanglement entropy versus an L1 penalty), so no record or citation repairs the claim.',
  'Q-BR-010':
    'The bridge asserts a QUBO reduction of the Grad-Shafranov PDE that neither cited source supplies. Until a reduction with a stated discretisation and penalty formulation exists, there is nothing to review.',
  'Q-BR-011':
    'The Side B citation could not be located in any authoritative index. A bridge resting on an unlocatable source is not remediable by adding records.',
}

export function buildGapReport(): GapReport {
  const endpointTotals: Record<string, number> = {}
  const sourceTotals: Record<string, number> = {}
  const verdictTotals: Record<string, number> = {}
  const blockerTotals: Record<string, number> = {}

  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    verdictTotals[bridge.verdict] = (verdictTotals[bridge.verdict] ?? 0) + 1
    for (const code of bridge.blockerCodes) blockerTotals[code] = (blockerTotals[code] ?? 0) + 1
    for (const endpoint of [bridge.endpoints.source, bridge.endpoints.target]) {
      const status = endpoint.outcome.status
      endpointTotals[status] = (endpointTotals[status] ?? 0) + 1
    }
  }
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    for (const source of candidate.sources) {
      sourceTotals[source.verification] = (sourceTotals[source.verification] ?? 0) + 1
    }
  }

  const remediableToRevise = QUANTUM_BRIDGE_AUDIT.filter((bridge) => !CONCEPTUAL_DEFECTS[bridge.id]).map(
    (bridge) => ({
      id: bridge.id,
      remediation: [
        bridge.blockerCodes.includes('endpoint-unresolved-record')
          ? 'create the missing canonical record(s) for the named endpoints'
          : null,
        bridge.blockerCodes.includes('endpoint-incompatible-record-class')
          ? 'promote the pilot entry to a canonical graph record'
          : null,
        bridge.blockerCodes.includes('source-missing-locator') ? 'supply exact locators' : null,
        bridge.blockerCodes.includes('source-missing-identifier') ? 'supply stable identifiers' : null,
        bridge.blockerCodes.includes('rights-basis-unverified') ? 'establish a rights basis' : null,
      ]
        .filter(Boolean)
        .join('; '),
    }),
  )

  return {
    auditPackageVersion: AUDIT_PACKAGE_VERSION,
    resolverVersion: REFERENCE_RESOLVER_VERSION,
    endpointTotals,
    sourceTotals,
    verdictTotals,
    blockerTotals,
    remediableToRevise,
    conceptuallyInvalid: Object.entries(CONCEPTUAL_DEFECTS).map(([id, reason]) => ({ id, reason })),
    namespaces: namespaceInventory(),
  }
}

/** Endpoint-level table for the human-readable report. */
export function endpointTable() {
  return QUANTUM_BRIDGE_AUDIT.flatMap((bridge) =>
    (['source', 'target'] as const).map((side) => {
      const result = bridge.endpoints[side]
      const outcome = result.outcome
      return {
        id: bridge.id,
        side,
        submittedReference: result.submittedReference,
        status: outcome.status,
        recordId: isResolvedOutcome(outcome) ? (outcome as { recordId: string }).recordId : null,
        normalizedReference:
          outcome.status === 'alias-resolution' || outcome.status === 'unresolved-record'
            ? ((outcome as { normalizedReference?: string }).normalizedReference ?? null)
            : null,
      }
    }),
  )
}
