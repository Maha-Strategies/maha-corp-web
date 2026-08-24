import {
  EPISTEMIC_POLICY_VERSION,
  EPISTEMIC_SCHEMA_VERSION,
  type BridgeType,
  type ClaimKind,
  type EpistemicRecord,
  type EpistemicRecordKind,
  type EpistemicSource,
  type EvidenceMaturity,
} from './epistemic-schema.ts'

export const EPISTEMIC_GRAPH_RELEASE_DATE = '2026-08-24' as const

export interface GraphDependency {
  targetId: string
  bridgeType?: BridgeType
  statement: string
  epistemicWarning?: string
}

export interface EpistemicGraphSeed {
  domainSlug: 'quantum-systems' | 'synthetic-biology'
  recordKind: EpistemicRecordKind
  slug: string
  title: string
  description: string
  summary: string
  statement: string
  claimKind: ClaimKind
  evidenceMaturity: Exclude<EvidenceMaturity, 'not-assessed'>
  scope: string
  boundary: string
  uncertainty: string
  replication: string
  source: EpistemicSource
  dependencies: GraphDependency[]
  prohibitedInference: string
}

export function buildEpistemicGraphRecord(seed: EpistemicGraphSeed): EpistemicRecord {
  const recordId = `urn:maha:record:${seed.slug}`
  const claimId = `urn:maha:claim:${seed.slug}`

  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId,
    domainSlug: seed.domainSlug,
    recordKind: seed.recordKind,
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    summary: seed.summary,
    claims: [{
      id: claimId,
      statement: seed.statement,
      claimKind: seed.claimKind,
      evidenceMaturity: seed.evidenceMaturity,
      sourceIds: [seed.source.id],
      scope: seed.scope,
      boundary: seed.boundary,
      uncertainty: {
        kind: seed.claimKind === 'formal-proposition' ? 'not-applicable' : 'qualitative',
        statement: seed.uncertainty,
      },
      replication: {
        independentReplicationCount: null,
        assessment: seed.replication,
        asOfDate: EPISTEMIC_GRAPH_RELEASE_DATE,
      },
    }],
    sources: [seed.source],
    sections: [
      {
        heading: 'What the cited work establishes',
        paragraphs: [seed.source.establishes, seed.scope],
        claimIds: [claimId],
      },
      {
        heading: 'What remains a separate question',
        paragraphs: [seed.boundary, seed.source.boundary],
        claimIds: [],
      },
    ],
    bridges: seed.dependencies.map((dependency, index) => ({
      id: `urn:maha:bridge:${seed.slug}-${index + 1}`,
      sourceConceptId: recordId,
      targetConceptId: dependency.targetId,
      bridgeType: dependency.bridgeType ?? 'mechanistic-dependency',
      statement: dependency.statement,
      epistemicWarning: dependency.epistemicWarning,
    })),
    boundaries: [
      seed.boundary,
      'A source-bounded mechanism, method, or measurement record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record.',
    ],
    prohibitedInferences: [
      seed.prohibitedInference,
      'Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.',
    ],
    publication: {
      requestedPublicPromotion: false,
      reviewState: 'draft',
      canonicalVersion: '0.1.0',
      lastReviewedAt: `${EPISTEMIC_GRAPH_RELEASE_DATE}T00:00:00.000Z`,
      requiredReviewScopes: ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator'],
      reviewEvents: [],
    },
  }
}
