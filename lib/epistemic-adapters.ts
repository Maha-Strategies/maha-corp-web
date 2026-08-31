import {
  ASTRONOMY_ARTICLES,
  ASTRONOMY_KNOWLEDGE_VERSION,
  ASTRONOMY_SOURCES,
  astronomyArticlePath,
} from './astronomy-knowledge.ts'
import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_SOURCES,
  knowledgeArticlePath,
  type KnowledgeArticle,
} from './knowledge-data.ts'
import {
  MATHEMATICAL_CONCEPTS,
  MATHEMATICS_KNOWLEDGE_RELEASE_DATE,
  MATHEMATICS_KNOWLEDGE_VERSION,
  MATHEMATICS_SOURCES,
  mathematicsConceptPath,
} from './mathematics-knowledge.ts'
import {
  NEUROMORPHIC_CONCEPTS,
  NEUROMORPHIC_RELEASE_DATE,
  NEUROMORPHIC_SOURCES,
  NEUROMORPHIC_VERSION,
  neuromorphicConceptPath,
} from './neuromorphic-biocomputing.ts'
import {
  RELIGION_CONCEPTS,
  RELIGION_KNOWLEDGE_RELEASE_DATE,
  RELIGION_KNOWLEDGE_VERSION,
  RELIGION_SOURCES,
  religionConceptPath,
} from './religion-knowledge.ts'
import { FRONTIER_CANARY_RECORDS, FRONTIER_CANARY_VERSION } from './frontier-canonicalization.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from './quantum-systems-graph.ts'
import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { BATCH_2_INTERNAL_REVIEW_RECORD_IDS } from './substantial-internal-review-cohort.ts'
import { SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS } from './substantial-scale-cohort.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'
import {
  SOURCE_OVERRIDE_REVISED_INGESTION_RECORDS,
  SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
} from './source-override-revision-ingestion-records.ts'
import {
  MCP_PRIVATE_CANARY_ADAPTER_ID,
  MCP_PRIVATE_CANARY_DATASET_VERSION,
  MCP_PRIVATE_CANARY_RECORD,
} from './mcp-private-canary-release.ts'
import {
  EPISTEMIC_POLICY_VERSION,
  EPISTEMIC_SCHEMA_VERSION,
  EXPERT_REVIEW_SCOPES,
  type EpistemicClaim,
  type EpistemicRecord,
  type EpistemicSource,
  type PublicationDecision,
} from './epistemic-schema.ts'
import {
  assertGraphIntegrity,
  epistemicRecordPath,
  epistemicReviewTargetHash,
  evaluatePublicationGate,
  sha256Canonical,
} from './epistemic-publication.ts'

export const EPISTEMIC_ADAPTER_VERSION = 'maha-epistemic-adapter/1.0' as const
export const EPISTEMIC_MIGRATION_DATE = '2026-08-24' as const

export const LEGACY_ADAPTER_IDS = [
  'semiconductor',
  'mathematics',
  'astronomy',
  'religion',
  'neuromorphic-biocomputing',
  'frontier-canary',
  'substantial-batch-2-internal-review',
  'substantial-scale-release',
  'repaired-revision-canary',
  'source-override-revision-canary',
  'batch-11-mixed-lineage-rehearsal',
  MCP_PRIVATE_CANARY_ADAPTER_ID,
] as const

export type LegacyAdapterId = (typeof LEGACY_ADAPTER_IDS)[number]

export interface LegacyAdapterCandidate {
  schemaVersion: typeof EPISTEMIC_ADAPTER_VERSION
  adapterId: LegacyAdapterId
  adapterVersion: string
  sourceDatasetVersion: string
  sourceDatasetSha256: string
  sourceRecordId: string
  sourceRecordSha256: string
  sourcePublicPath: string
  candidateSha256: string
  reviewTargetSha256: string
  record: EpistemicRecord
  gateDecision: PublicationDecision
}

export interface LegacyAdapterDefinition {
  id: LegacyAdapterId
  name: string
  description: string
  adapterVersion: typeof EPISTEMIC_ADAPTER_VERSION
  sourceDatasetVersion: string
  sourceDatasetSha256: string
  sourceRecordCount: number
  adapt: () => LegacyAdapterCandidate[]
}

type LegacySource = {
  id: string
  title: string
  publisher: string
  url: string
  establishes?: string
  boundary?: string
  year?: number
}

const safe = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

function importedSource(domainSlug: string, source: LegacySource, recordTitle: string): EpistemicSource {
  return {
    id: `legacy-${safe(domainSlug)}-${safe(source.id)}`,
    title: source.title,
    authors: [],
    publisher: source.publisher,
    publishedAt: source.year ? `${source.year}-01-01` : '',
    url: source.url,
    identifiers: [{ scheme: 'url', value: source.url }],
    exactLocator: '',
    rights: {
      basis: 'citation-with-paraphrase',
      quotationUsed: false,
      note: 'The legacy Maha record uses original explanatory prose and links to the source. Passage-level rights and locator review remain required before promotion through the epistemic gateway.',
    },
    establishes: source.establishes ?? `This legacy source is cited by “${recordTitle}”; its exact supporting scope has not yet been normalized at passage level.`,
    boundary: source.boundary ?? 'A title and URL identify a source but do not establish which exact passage supports a particular claim.',
  }
}

function importedClaim(input: {
  domainSlug: string
  recordSlug: string
  index: number
  statement: string
  sourceIds: string[]
  claimKind: EpistemicClaim['claimKind']
  scope: string
  boundary: string
}): EpistemicClaim {
  return {
    id: `urn:maha:claim:legacy-${safe(input.domainSlug)}-${safe(input.recordSlug)}-${String(input.index + 1).padStart(2, '0')}`,
    statement: input.statement,
    claimKind: input.claimKind,
    evidenceMaturity: 'not-assessed',
    sourceIds: input.sourceIds.map((id) => `legacy-${safe(input.domainSlug)}-${safe(id)}`),
    scope: input.scope,
    boundary: input.boundary,
    uncertainty: {
      kind: 'not-reported',
      statement: 'The legacy corpus did not encode a claim-specific uncertainty assessment in the Phase 1 epistemic format.',
    },
    replication: {
      independentReplicationCount: null,
      assessment: 'Replication has not been compiled for this imported claim. Source count is not treated as replication count.',
      asOfDate: EPISTEMIC_MIGRATION_DATE,
    },
  }
}

function draftPublication(version: string, modifiedAt: string): EpistemicRecord['publication'] {
  return {
    requestedPublicPromotion: false,
    reviewState: 'draft',
    canonicalVersion: version,
    lastReviewedAt: `${modifiedAt}T00:00:00.000Z`,
    requiredReviewScopes: [...EXPERT_REVIEW_SCOPES],
    reviewEvents: [],
  }
}

function candidate(input: {
  adapterId: LegacyAdapterId
  adapterVersion: string
  sourceDatasetVersion: string
  sourceDatasetSha256: string
  sourceRecordId: string
  sourceRecord: unknown
  sourcePublicPath: string
  record: EpistemicRecord
}): LegacyAdapterCandidate {
  const gateDecision = evaluatePublicationGate(input.record)
  if (gateDecision.publicEligible) throw new Error(`${input.adapterId}:${input.sourceRecordId} bypassed legacy review.`)
  return {
    schemaVersion: EPISTEMIC_ADAPTER_VERSION,
    adapterId: input.adapterId,
    adapterVersion: input.adapterVersion,
    sourceDatasetVersion: input.sourceDatasetVersion,
    sourceDatasetSha256: input.sourceDatasetSha256,
    sourceRecordId: input.sourceRecordId,
    sourceRecordSha256: sha256Canonical(input.sourceRecord),
    sourcePublicPath: input.sourcePublicPath,
    candidateSha256: sha256Canonical(input.record),
    reviewTargetSha256: epistemicReviewTargetHash(input.record),
    record: input.record,
    gateDecision,
  }
}

function recordId(domainSlug: string, slug: string) {
  return `urn:maha:record:legacy-${safe(domainSlug)}-${safe(slug)}`
}

function semiconductorRecord(article: KnowledgeArticle): EpistemicRecord {
  const sourceMap = new Map(KNOWLEDGE_SOURCES.map((source) => [source.id, source]))
  const sourceIds = [...new Set([...article.sourceIds, ...article.claims.flatMap((claim) => claim.sourceIds)])]
  const claims = article.claims.map((claim, index) => importedClaim({
    domainSlug: 'semiconductor',
    recordSlug: article.slug,
    index,
    statement: claim.statement,
    sourceIds: claim.sourceIds,
    claimKind: ['method-basis', 'model-dependent'].includes(claim.empirical) ? 'theoretical-model' : 'empirical-claim',
    scope: `The semiconductor article at ${knowledgeArticlePath(article)} and the production context named by its cited sources.`,
    boundary: claim.boundary ?? 'The legacy claim requires expert review for process generation, equipment configuration, product, site, and interested-party transfer limits.',
  }))
  const claimIds = new Map(article.claims.map((claim, index) => [claim.id, claims[index].id]))
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId('semiconductor', article.slug),
    domainSlug: 'semiconductor',
    recordKind: ({ domain: 'concept', process: 'mechanism', material: 'concept', equipment: 'concept', concept: 'concept' } as const)[article.kind],
    slug: article.slug,
    title: article.title,
    description: article.description,
    summary: article.definition,
    claims,
    sources: sourceIds.map((id) => importedSource('semiconductor', sourceMap.get(id)!, article.title)),
    sections: article.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
      claimIds: (section.claimIds ?? []).map((id) => claimIds.get(id)!).filter(Boolean),
    })),
    bridges: [],
    boundaries: [
      'Manufacturing claims remain bounded to the named process, equipment, material, product generation, site, and measurement method.',
      ...article.claims.flatMap((claim) => claim.boundary ? [claim.boundary] : []),
    ],
    prohibitedInferences: [
      'Do not infer supplier qualification, production yield, process capability, or commercial readiness from a general process description.',
      'Do not transfer vendor-stated performance to another tool, fab, material set, product, or operating window without independent evidence.',
    ],
    publication: draftPublication('legacy-import/1.0', article.dateModified),
  }
}

function mathematicsRecord(concept: (typeof MATHEMATICAL_CONCEPTS)[number]): EpistemicRecord {
  const sourceMap = new Map(MATHEMATICS_SOURCES.map((source) => [source.id, source]))
  const claim = importedClaim({
    domainSlug: 'mathematics', recordSlug: concept.slug, index: 0,
    statement: concept.definition,
    sourceIds: concept.sourceIds,
    claimKind: 'formal-proposition',
    scope: `The definitions, assumptions, notation, and method declared by the ${concept.name} legacy reference.`,
    boundary: concept.doesNotEstablish,
  })
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId('mathematics', concept.slug),
    domainSlug: 'mathematics',
    recordKind: concept.proofStatus === 'method' ? 'method' : 'concept',
    slug: concept.slug,
    title: concept.name,
    description: concept.description,
    summary: concept.definition,
    claims: [claim],
    sources: concept.sourceIds.map((id) => importedSource('mathematics', sourceMap.get(id)!, concept.name)),
    sections: [
      { heading: 'Assumptions and invariants', paragraphs: [...concept.assumptions, ...concept.invariants], claimIds: [claim.id] },
      { heading: 'Procedure', paragraphs: concept.procedure, claimIds: [claim.id] },
      { heading: 'Error and non-transfer boundaries', paragraphs: [...concept.errorBounds, concept.doesNotEstablish], claimIds: [] },
    ],
    bridges: [],
    boundaries: [...concept.errorBounds, concept.doesNotEstablish],
    prohibitedInferences: [concept.doesNotEstablish, 'Do not treat formal validity as empirical validation of a domain claim represented with the mathematics.'],
    publication: draftPublication('legacy-import/1.0', MATHEMATICS_KNOWLEDGE_RELEASE_DATE),
  }
}

function astronomyRecord(article: (typeof ASTRONOMY_ARTICLES)[number]): EpistemicRecord {
  const sourceMap = new Map(ASTRONOMY_SOURCES.map((source) => [source.id, source]))
  const claims = article.claims.map((claim, index) => importedClaim({
    domainSlug: 'astronomy', recordSlug: article.slug, index,
    statement: claim.statement,
    sourceIds: claim.sourceIds,
    claimKind: claim.evidenceState === 'direct-observation' || claim.evidenceState === 'calibrated-measurement'
      ? 'observation'
      : claim.evidenceState === 'model-dependent' ? 'theoretical-model' : 'empirical-claim',
    scope: `The observation, model, calibration, and release assumptions named by the astronomy article at ${astronomyArticlePath(article)}.`,
    boundary: claim.boundary,
  }))
  const claimIds = new Map(article.claims.map((claim, index) => [claim.id, claims[index].id]))
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId('astronomy', article.slug),
    domainSlug: 'astronomy',
    recordKind: article.kind === 'physical-process' ? 'mechanism' : article.kind === 'method' ? 'method' : 'concept',
    slug: article.slug,
    title: article.title,
    description: article.description,
    summary: article.definition,
    claims,
    sources: article.sourceIds.map((id) => importedSource('astronomy', sourceMap.get(id)!, article.title)),
    sections: article.sections.map((section) => ({ heading: section.heading, paragraphs: section.paragraphs, claimIds: section.claimIds.map((id) => claimIds.get(id)!).filter(Boolean) })),
    bridges: [],
    boundaries: article.limitations,
    prohibitedInferences: [
      'Do not detach an astronomical value from its observer, frame, epoch, calibration, release, uncertainty, and model assumptions.',
      'Do not treat astronomical calculation accuracy as validation of an astrological interpretation.',
    ],
    publication: draftPublication('legacy-import/1.0', article.dateModified),
  }
}

function religionRecord(concept: (typeof RELIGION_CONCEPTS)[number]): EpistemicRecord {
  const sourceMap = new Map(RELIGION_SOURCES.map((source) => [source.id, source]))
  const claim = importedClaim({
    domainSlug: 'religion', recordSlug: concept.slug, index: 0,
    statement: concept.definition,
    sourceIds: concept.sourceIds,
    claimKind: 'interpretation',
    scope: `The comparative-method concept “${concept.name}”; authority and truth claims remain tradition-relative and separately assessed.`,
    boundary: concept.doesNotEstablish.join(' '),
  })
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId('religion', concept.slug),
    domainSlug: 'religion',
    recordKind: 'concept',
    slug: concept.slug,
    title: concept.name,
    description: concept.description,
    summary: concept.definition,
    claims: [claim],
    sources: concept.sourceIds.map((id) => importedSource('religion', sourceMap.get(id)!, concept.name)),
    sections: [
      { heading: 'Questions and evidence inputs', paragraphs: [...concept.questions, ...concept.evidenceInputs], claimIds: [claim.id] },
      { heading: 'Method', paragraphs: concept.method, claimIds: [claim.id] },
      { heading: 'Interpretive risks', paragraphs: concept.interpretiveRisks, claimIds: [] },
    ],
    bridges: [],
    boundaries: [...concept.doesNotEstablish, ...concept.interpretiveRisks],
    prohibitedInferences: [
      ...concept.doesNotEstablish,
      'Do not collapse documentary evidence, lived practice, institutional authority, theology, and empirical claims into one truth status.',
    ],
    publication: draftPublication('legacy-import/1.0', RELIGION_KNOWLEDGE_RELEASE_DATE),
  }
}

function neuromorphicRecord(concept: (typeof NEUROMORPHIC_CONCEPTS)[number]): EpistemicRecord {
  const sourceMap = new Map(NEUROMORPHIC_SOURCES.map((source) => [source.id, source]))
  const claim = importedClaim({
    domainSlug: 'neuromorphic-biocomputing', recordSlug: concept.slug, index: 0,
    statement: concept.definition,
    sourceIds: concept.sourceIds,
    claimKind: concept.substrate === 'software-model' ? 'theoretical-model' : 'empirical-claim',
    scope: `The substrate, mechanism, measurements, and maturity class named by the ${concept.name} legacy record.`,
    boundary: concept.limitations.join(' '),
  })
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: recordId('neuromorphic-biocomputing', concept.slug),
    domainSlug: 'neuromorphic-biocomputing',
    recordKind: concept.substrate === 'software-model' ? 'concept' : 'mechanism',
    slug: concept.slug,
    title: concept.name,
    description: concept.description,
    summary: concept.definition,
    claims: [claim],
    sources: concept.sourceIds.map((id) => importedSource('neuromorphic-biocomputing', sourceMap.get(id)!, concept.name)),
    sections: [
      { heading: 'Mechanism', paragraphs: concept.mechanism, claimIds: [claim.id] },
      { heading: 'Measurements', paragraphs: concept.measurements, claimIds: [claim.id] },
      { heading: 'Reproducibility controls', paragraphs: concept.reproducibilityControls, claimIds: [] },
    ],
    bridges: [],
    boundaries: concept.limitations,
    prohibitedInferences: [
      'Do not infer cognition, consciousness, sentience, biological equivalence, deployment readiness, or energy superiority from this concept record.',
      'Do not compare silicon and living systems without matching task, system boundary, lifecycle cost, uncertainty, and replication unit.',
    ],
    publication: draftPublication('legacy-import/1.0', NEUROMORPHIC_RELEASE_DATE),
  }
}

export function definition(input: {
  id: LegacyAdapterId
  name: string
  description: string
  sourceDatasetVersion: string
  sourceRecords: readonly unknown[]
  sourceSources: readonly unknown[]
  build: () => Array<{ sourceRecordId: string; sourceRecord: unknown; sourcePublicPath: string; record: EpistemicRecord }>
}): LegacyAdapterDefinition {
  const sourceDatasetSha256 = sha256Canonical({ records: input.sourceRecords, sources: input.sourceSources })
  const adapterVersion = EPISTEMIC_ADAPTER_VERSION
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    adapterVersion,
    sourceDatasetVersion: input.sourceDatasetVersion,
    sourceDatasetSha256,
    sourceRecordCount: input.sourceRecords.length,
    adapt: () => input.build().map((item) => candidate({
      adapterId: input.id,
      adapterVersion,
      sourceDatasetVersion: input.sourceDatasetVersion,
      sourceDatasetSha256,
      ...item,
    })),
  }
}

export const LEGACY_EPISTEMIC_ADAPTERS: readonly LegacyAdapterDefinition[] = [
  definition({
    id: 'semiconductor', name: 'Semiconductor manufacturing', description: 'Process, material, equipment, and system records with supplier and standards sources.',
    sourceDatasetVersion: 'semiconductor-knowledge/1.0', sourceRecords: KNOWLEDGE_ARTICLES, sourceSources: KNOWLEDGE_SOURCES,
    build: () => KNOWLEDGE_ARTICLES.map((article) => ({ sourceRecordId: article.id, sourceRecord: article, sourcePublicPath: knowledgeArticlePath(article), record: semiconductorRecord(article) })),
  }),
  definition({
    id: 'mathematics', name: 'Mathematics', description: 'Definitions, methods, assumptions, invariants, error bounds, and cross-domain non-transfer limits.',
    sourceDatasetVersion: MATHEMATICS_KNOWLEDGE_VERSION, sourceRecords: MATHEMATICAL_CONCEPTS, sourceSources: MATHEMATICS_SOURCES,
    build: () => MATHEMATICAL_CONCEPTS.map((concept) => ({ sourceRecordId: concept.id, sourceRecord: concept, sourcePublicPath: mathematicsConceptPath(concept), record: mathematicsRecord(concept) })),
  }),
  definition({
    id: 'astronomy', name: 'Astronomy', description: 'Observation, measurement, model, and uncertainty records with calculation boundaries.',
    sourceDatasetVersion: ASTRONOMY_KNOWLEDGE_VERSION, sourceRecords: ASTRONOMY_ARTICLES, sourceSources: ASTRONOMY_SOURCES,
    build: () => ASTRONOMY_ARTICLES.map((article) => ({ sourceRecordId: article.id, sourceRecord: article, sourcePublicPath: astronomyArticlePath(article), record: astronomyRecord(article) })),
  }),
  definition({
    id: 'religion', name: 'Religion and contemplative traditions', description: 'Methodological concepts that keep documentary, historical, theological, lived-practice, and empirical claims distinct.',
    sourceDatasetVersion: RELIGION_KNOWLEDGE_VERSION, sourceRecords: RELIGION_CONCEPTS, sourceSources: RELIGION_SOURCES,
    build: () => RELIGION_CONCEPTS.map((concept) => ({ sourceRecordId: concept.id, sourceRecord: concept, sourcePublicPath: religionConceptPath(concept), record: religionRecord(concept) })),
  }),
  definition({
    id: 'neuromorphic-biocomputing', name: 'Neuromorphic and biocomputing', description: 'Substrate-aware concepts with explicit measurement, reproducibility, consciousness, and readiness boundaries.',
    sourceDatasetVersion: NEUROMORPHIC_VERSION, sourceRecords: NEUROMORPHIC_CONCEPTS, sourceSources: NEUROMORPHIC_SOURCES,
    build: () => NEUROMORPHIC_CONCEPTS.map((concept) => ({ sourceRecordId: concept.id, sourceRecord: concept, sourcePublicPath: neuromorphicConceptPath(concept), record: neuromorphicRecord(concept) })),
  }),
] as const

export const FRONTIER_CANARY_EPISTEMIC_ADAPTER: LegacyAdapterDefinition = definition({
  id: 'frontier-canary',
  name: 'Frontier canonicalization canary',
  description: 'The pre-registered five-record-per-domain canary only; controls remain in the private factory target ledger.',
  sourceDatasetVersion: FRONTIER_CANARY_VERSION,
  sourceRecords: FRONTIER_CANARY_RECORDS,
  sourceSources: FRONTIER_CANARY_RECORDS.flatMap((record) => record.sources),
  build: () => FRONTIER_CANARY_RECORDS.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: structuredClone(record),
  })),
})

const substantialBatch2ReviewIdSet = new Set<string>(BATCH_2_INTERNAL_REVIEW_RECORD_IDS)
const substantialBatch2ReviewRecords = [...FRONTIER_DOMAIN_GRAPH_RECORDS, ...QUANTUM_SYSTEMS_GRAPH_RECORDS]
  .filter((record) => substantialBatch2ReviewIdSet.has(record.id))

if (substantialBatch2ReviewRecords.length !== BATCH_2_INTERNAL_REVIEW_RECORD_IDS.length) {
  throw new Error(`Batch 2 internal-review adapter resolved ${substantialBatch2ReviewRecords.length}/${BATCH_2_INTERNAL_REVIEW_RECORD_IDS.length} records.`)
}

export const SUBSTANTIAL_BATCH_2_INTERNAL_REVIEW_ADAPTER: LegacyAdapterDefinition = definition({
  id: 'substantial-batch-2-internal-review',
  name: 'Substantial Batch 2 internal-review targets',
  description: 'The exact 27 current revisions requiring scoped internal editorial decisions; ingestion freezes targets and never approves or publishes them.',
  sourceDatasetVersion: 'maha-internal-review-batch-2/1.0',
  sourceRecords: substantialBatch2ReviewRecords,
  sourceSources: substantialBatch2ReviewRecords.flatMap((record) => record.sources),
  build: () => substantialBatch2ReviewRecords.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: structuredClone(record),
  })),
})

const substantialScaleRecordIds = new Set<string>(SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS)
const substantialScaleRecords = EPISTEMIC_RECORDS.filter((record) => substantialScaleRecordIds.has(record.id))

if (substantialScaleRecords.length !== SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.length) {
  throw new Error(`Substantial scale adapter resolved ${substantialScaleRecords.length}/${SUBSTANTIAL_SCALE_RELEASE_RECORD_IDS.length} records.`)
}

export const SUBSTANTIAL_SCALE_RELEASE_ADAPTER: LegacyAdapterDefinition = definition({
  id: 'substantial-scale-release',
  name: 'Substantial release-scale targets',
  description: 'Exactly 64 inspected, alignment-clear, substantial-quality-eligible revisions; ingestion freezes targets and never approves or publishes them.',
  sourceDatasetVersion: 'maha-substantial-scale-review/1.0',
  sourceRecords: substantialScaleRecords,
  sourceSources: substantialScaleRecords.flatMap((record) => record.sources),
  build: () => substantialScaleRecords.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: {
      ...structuredClone(record),
      publication: draftPublication('substantial-scale/1.0', '2026-08-30'),
    },
  })),
})

export const REPAIRED_REVISION_CANARY_ADAPTER: LegacyAdapterDefinition = definition({
  id: 'repaired-revision-canary',
  name: 'Repaired revision canonicalization canary',
  description: 'Exactly two internally reviewed repaired revisions; ingestion freezes their new targets and never approves or publishes them.',
  sourceDatasetVersion: 'maha-repaired-revision-canary/1.0',
  sourceRecords: REPAIRED_REVISION_CANARY_RECORDS,
  sourceSources: REPAIRED_REVISION_CANARY_RECORDS.flatMap((record) => record.sources),
  build: () => REPAIRED_REVISION_CANARY_RECORDS.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: structuredClone(record),
  })),
})

export const SOURCE_OVERRIDE_REVISION_CANARY_ADAPTER: LegacyAdapterDefinition = definition({
  id: 'source-override-revision-canary',
  name: 'Source-override exact-revision Preview canary',
  description: 'Exactly five internally reviewed replacement-source revisions; ingestion freezes draft targets and cannot approve or release them.',
  sourceDatasetVersion: SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
  sourceRecords: SOURCE_OVERRIDE_REVISED_INGESTION_RECORDS,
  sourceSources: SOURCE_OVERRIDE_REVISED_INGESTION_RECORDS.flatMap((record) => record.sources),
  build: () => SOURCE_OVERRIDE_REVISED_INGESTION_RECORDS.map((record) => ({
    sourceRecordId: record.id,
    sourceRecord: record,
    sourcePublicPath: epistemicRecordPath(record),
    record: structuredClone(record),
  })),
})

export const MCP_PRIVATE_CANARY_ADAPTER: LegacyAdapterDefinition = definition({
  id: MCP_PRIVATE_CANARY_ADAPTER_ID,
  name: 'Synthetic private MCP governed-release canary',
  description: 'Exactly one synthetic Preview-only method record. Ingestion freezes a draft target and cannot review or release it.',
  sourceDatasetVersion: MCP_PRIVATE_CANARY_DATASET_VERSION,
  sourceRecords: [MCP_PRIVATE_CANARY_RECORD],
  sourceSources: MCP_PRIVATE_CANARY_RECORD.sources,
  build: () => [{
    sourceRecordId: MCP_PRIVATE_CANARY_RECORD.id,
    sourceRecord: MCP_PRIVATE_CANARY_RECORD,
    sourcePublicPath: '/knowledge/agentic-systems-mcp/methods/synthetic-private-mcp-release-fixture',
    record: structuredClone(MCP_PRIVATE_CANARY_RECORD),
  }],
})

export const ADAPTED_EPISTEMIC_CANDIDATES = LEGACY_EPISTEMIC_ADAPTERS.flatMap((adapter) => adapter.adapt())
assertGraphIntegrity(ADAPTED_EPISTEMIC_CANDIDATES.map((item) => item.record))

export function getLegacyEpistemicAdapter(id: string) {
  return id === FRONTIER_CANARY_EPISTEMIC_ADAPTER.id
    ? FRONTIER_CANARY_EPISTEMIC_ADAPTER
    : id === SUBSTANTIAL_BATCH_2_INTERNAL_REVIEW_ADAPTER.id
      ? SUBSTANTIAL_BATCH_2_INTERNAL_REVIEW_ADAPTER
    : id === SUBSTANTIAL_SCALE_RELEASE_ADAPTER.id
      ? SUBSTANTIAL_SCALE_RELEASE_ADAPTER
    : id === REPAIRED_REVISION_CANARY_ADAPTER.id
      ? REPAIRED_REVISION_CANARY_ADAPTER
    : id === SOURCE_OVERRIDE_REVISION_CANARY_ADAPTER.id
      ? SOURCE_OVERRIDE_REVISION_CANARY_ADAPTER
    : id === MCP_PRIVATE_CANARY_ADAPTER.id
      ? MCP_PRIVATE_CANARY_ADAPTER
    : LEGACY_EPISTEMIC_ADAPTERS.find((adapter) => adapter.id === id)
}

export function buildEpistemicMigrationInventory() {
  const adapters = LEGACY_EPISTEMIC_ADAPTERS.map((adapter) => {
    const records = adapter.adapt()
    const issueCounts = new Map<string, number>()
    for (const record of records) for (const reason of record.gateDecision.reasons) {
      const category = reason.split(':')[0]
      issueCounts.set(category, (issueCounts.get(category) ?? 0) + 1)
    }
    return {
      id: adapter.id,
      name: adapter.name,
      description: adapter.description,
      adapterVersion: adapter.adapterVersion,
      sourceDatasetVersion: adapter.sourceDatasetVersion,
      sourceDatasetSha256: adapter.sourceDatasetSha256,
      counts: {
        sourceRecords: records.length,
        publicEligible: records.filter((record) => record.gateDecision.publicEligible).length,
        withheld: records.filter((record) => !record.gateDecision.publicEligible).length,
      },
      requiredReviewScopes: EXPERT_REVIEW_SCOPES,
      issueCounts: Object.fromEntries([...issueCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
      records: records.map((record) => ({
        sourceRecordId: record.sourceRecordId,
        sourcePublicPath: record.sourcePublicPath,
        candidateRecordId: record.record.id,
        candidateSha256: record.candidateSha256,
        reviewTargetSha256: record.reviewTargetSha256,
        publicEligible: record.gateDecision.publicEligible,
        gateReasons: record.gateDecision.reasons,
      })),
    }
  })
  return {
    schemaVersion: EPISTEMIC_ADAPTER_VERSION,
    generatedAt: `${EPISTEMIC_MIGRATION_DATE}T00:00:00.000Z`,
    policy: 'Legacy public content is imported as a draft candidate, never as a canonical approval. Exact locators, evidence maturity, and all required expert scopes must be resolved against the frozen review-target hash before promotion.',
    counts: {
      adapters: adapters.length,
      sourceRecords: adapters.reduce((total, adapter) => total + adapter.counts.sourceRecords, 0),
      publicEligible: adapters.reduce((total, adapter) => total + adapter.counts.publicEligible, 0),
      withheld: adapters.reduce((total, adapter) => total + adapter.counts.withheld, 0),
    },
    adapters,
  }
}

export const EPISTEMIC_MIGRATION_INVENTORY = buildEpistemicMigrationInventory()
