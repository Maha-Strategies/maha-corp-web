import { randomUUID } from 'node:crypto'

import { buildEpistemicCandidateAudit, type EpistemicCandidateAudit } from './epistemic-audit.ts'
import {
  BRIDGE_TYPES,
  CLAIM_KINDS,
  EPISTEMIC_POLICY_VERSION,
  EPISTEMIC_SCHEMA_VERSION,
  EVIDENCE_MATURITIES,
  EXPERT_REVIEW_SCOPES,
  RECORD_KINDS,
  RIGHTS_BASES,
  SOURCE_CHRONOLOGY_STATUSES,
  type EpistemicClaim,
  type EpistemicRecord,
  type MathematicalBridge,
} from './epistemic-schema.ts'
import {
  epistemicReviewTargetHash,
  evaluatePublicationGate,
  sha256Canonical,
} from './epistemic-publication.ts'

export const EPISTEMIC_FACTORY_MCP_VERSION = 'maha-epistemic-factory-mcp/0.1' as const
export const EPISTEMIC_FACTORY_JOB_VERSION = 'maha-epistemic-factory-job/0.1' as const

export const EPISTEMIC_FACTORY_TOOL_BOUNDARY = 'Factory tools compile and inspect exact noncanonical candidates. Automated conflict and bridge findings are review leads, not factual adjudication. Only the separate release-control route can request an already-approved exact-hash release.'

const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const CLAIM_ID = /^urn:maha:claim:[a-z0-9]+(?:-[a-z0-9]+)*$/
const BRIDGE_ID = /^urn:maha:bridge:[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PUBLIC_PATH = /^\/knowledge\/[a-z0-9/_-]+$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, label: string, minimum = 1, maximum = 4_000): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${label} must contain ${minimum}-${maximum} characters.`)
  return normalized
}

function stringArray(value: unknown, label: string, minimumItems = 0, maximumItems = 100): string[] {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    throw new Error(`${label} must contain ${minimumItems}-${maximumItems} entries.`)
  }
  return value.map((entry, index) => line(entry, `${label}[${index}]`))
}

/**
 * Authenticated callers still cross a complete structural boundary. This is
 * deliberately stricter than a TypeScript cast: malformed nested records must
 * fail before hashing, queue persistence, or conflict comparison.
 */
export function parseEpistemicFactoryRecord(value: unknown): EpistemicRecord {
  const record = object(value, 'record')
  if (record.schemaVersion !== EPISTEMIC_SCHEMA_VERSION) throw new Error(`record.schemaVersion must be ${EPISTEMIC_SCHEMA_VERSION}.`)
  if (record.evidencePolicyVersion !== EPISTEMIC_POLICY_VERSION) throw new Error(`record.evidencePolicyVersion must be ${EPISTEMIC_POLICY_VERSION}.`)
  const id = line(record.id, 'record.id', 10, 180)
  const domainSlug = line(record.domainSlug, 'record.domainSlug', 2, 80)
  const slug = line(record.slug, 'record.slug', 2, 120)
  const recordKind = line(record.recordKind, 'record.recordKind', 3, 40) as EpistemicRecord['recordKind']
  if (!RECORD_ID.test(id)) throw new Error('record.id must be a Maha record URN.')
  if (!SLUG.test(domainSlug) || !SLUG.test(slug)) throw new Error('record domain and record slugs must be lower-case slugs.')
  if (!RECORD_KINDS.includes(recordKind)) throw new Error('record.recordKind is unsupported.')

  if (!Array.isArray(record.claims) || !record.claims.length || record.claims.length > 100) throw new Error('record.claims must contain 1-100 claims.')
  const claims = record.claims.map((value, index): EpistemicClaim => {
    const claim = object(value, `record.claims[${index}]`)
    const claimId = line(claim.id, `record.claims[${index}].id`, 10, 180)
    if (!CLAIM_ID.test(claimId)) throw new Error(`record.claims[${index}].id must be a Maha claim URN.`)
    const uncertainty = object(claim.uncertainty, `record.claims[${index}].uncertainty`)
    const replication = object(claim.replication, `record.claims[${index}].replication`)
    const claimKind = line(claim.claimKind, `record.claims[${index}].claimKind`) as EpistemicClaim['claimKind']
    const evidenceMaturity = line(claim.evidenceMaturity, `record.claims[${index}].evidenceMaturity`) as EpistemicClaim['evidenceMaturity']
    const uncertaintyKind = line(uncertainty.kind, `record.claims[${index}].uncertainty.kind`) as EpistemicClaim['uncertainty']['kind']
    const replicationCount = replication.independentReplicationCount === null ? null : Number(replication.independentReplicationCount)
    if (!CLAIM_KINDS.includes(claimKind)) throw new Error(`record.claims[${index}].claimKind is unsupported.`)
    if (!EVIDENCE_MATURITIES.includes(evidenceMaturity)) throw new Error(`record.claims[${index}].evidenceMaturity is unsupported.`)
    if (!['quantitative', 'qualitative', 'not-reported', 'not-applicable'].includes(uncertaintyKind)) throw new Error(`record.claims[${index}].uncertainty.kind is unsupported.`)
    if (replicationCount !== null && (!Number.isInteger(replicationCount) || replicationCount < 0)) throw new Error(`record.claims[${index}].replication.independentReplicationCount must be a non-negative integer or null.`)
    return {
      id: claimId,
      statement: line(claim.statement, `record.claims[${index}].statement`, 10),
      claimKind,
      evidenceMaturity,
      sourceIds: stringArray(claim.sourceIds, `record.claims[${index}].sourceIds`, 1),
      scope: line(claim.scope, `record.claims[${index}].scope`, 10),
      boundary: line(claim.boundary, `record.claims[${index}].boundary`, 10),
      uncertainty: {
        kind: uncertaintyKind,
        statement: line(uncertainty.statement, `record.claims[${index}].uncertainty.statement`, 10),
        ...(typeof uncertainty.interval === 'string' ? { interval: line(uncertainty.interval, `record.claims[${index}].uncertainty.interval`) } : {}),
        ...(typeof uncertainty.units === 'string' ? { units: line(uncertainty.units, `record.claims[${index}].uncertainty.units`) } : {}),
      },
      replication: {
        independentReplicationCount: replicationCount,
        assessment: line(replication.assessment, `record.claims[${index}].replication.assessment`, 10),
        asOfDate: line(replication.asOfDate, `record.claims[${index}].replication.asOfDate`, 10, 10),
      },
    }
  })

  if (!Array.isArray(record.sources) || !record.sources.length || record.sources.length > 100) throw new Error('record.sources must contain 1-100 sources.')
  const sources = record.sources.map((value, index) => {
    const source = object(value, `record.sources[${index}]`)
    const rights = object(source.rights, `record.sources[${index}].rights`)
    const identifiers = Array.isArray(source.identifiers) ? source.identifiers.map((value, identifierIndex) => {
      const identifier = object(value, `record.sources[${index}].identifiers[${identifierIndex}]`)
      const scheme = line(identifier.scheme, `record.sources[${index}].identifiers[${identifierIndex}].scheme`) as EpistemicRecord['sources'][number]['identifiers'][number]['scheme']
      if (!['doi', 'isbn', 'url', 'dataset', 'standard', 'accession'].includes(scheme)) throw new Error(`record.sources[${index}].identifiers[${identifierIndex}].scheme is unsupported.`)
      return {
        scheme,
        value: line(identifier.value, `record.sources[${index}].identifiers[${identifierIndex}].value`),
      }
    }) : []
    const chronology = source.sourceChronology === undefined ? undefined : object(source.sourceChronology, `record.sources[${index}].sourceChronology`)
    const rightsBasis = line(rights.basis, `record.sources[${index}].rights.basis`) as EpistemicRecord['sources'][number]['rights']['basis']
    if (!RIGHTS_BASES.includes(rightsBasis)) throw new Error(`record.sources[${index}].rights.basis is unsupported.`)
    if (chronology) {
      const chronologyStatus = line(chronology.status, `record.sources[${index}].sourceChronology.status`) as 'undated' | 'living-document'
      if (!SOURCE_CHRONOLOGY_STATUSES.includes(chronologyStatus)) throw new Error(`record.sources[${index}].sourceChronology.status is unsupported.`)
    }
    return {
      id: line(source.id, `record.sources[${index}].id`, 3, 180),
      title: line(source.title, `record.sources[${index}].title`, 3, 500),
      authors: stringArray(source.authors, `record.sources[${index}].authors`, 0, 100),
      publisher: line(source.publisher, `record.sources[${index}].publisher`, 2, 300),
      publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt.trim() : '',
      ...(chronology ? { sourceChronology: {
        status: line(chronology.status, `record.sources[${index}].sourceChronology.status`) as 'undated' | 'living-document',
        accessedAt: line(chronology.accessedAt, `record.sources[${index}].sourceChronology.accessedAt`, 10, 10),
        ...(typeof chronology.sourceVersion === 'string' ? { sourceVersion: line(chronology.sourceVersion, `record.sources[${index}].sourceChronology.sourceVersion`) } : {}),
      } } : {}),
      url: line(source.url, `record.sources[${index}].url`, 8, 500),
      identifiers,
      exactLocator: typeof source.exactLocator === 'string' ? source.exactLocator.trim() : '',
      rights: {
        basis: rightsBasis,
        quotationUsed: rights.quotationUsed === true,
        note: line(rights.note, `record.sources[${index}].rights.note`, 10),
        ...(typeof rights.licenseName === 'string' ? { licenseName: line(rights.licenseName, `record.sources[${index}].rights.licenseName`) } : {}),
        ...(typeof rights.licenseUrl === 'string' ? { licenseUrl: line(rights.licenseUrl, `record.sources[${index}].rights.licenseUrl`) } : {}),
      },
      establishes: line(source.establishes, `record.sources[${index}].establishes`, 10),
      boundary: line(source.boundary, `record.sources[${index}].boundary`, 10),
      ...(typeof source.conflictsOfInterest === 'string' ? { conflictsOfInterest: line(source.conflictsOfInterest, `record.sources[${index}].conflictsOfInterest`) } : {}),
    }
  })

  if (!Array.isArray(record.sections) || !record.sections.length || record.sections.length > 50) throw new Error('record.sections must contain 1-50 sections.')
  const sections = record.sections.map((value, index) => {
    const section = object(value, `record.sections[${index}]`)
    return {
      heading: line(section.heading, `record.sections[${index}].heading`, 3, 300),
      paragraphs: stringArray(section.paragraphs, `record.sections[${index}].paragraphs`, 1, 100),
      claimIds: stringArray(section.claimIds, `record.sections[${index}].claimIds`, 0, 100),
    }
  })

  if (!Array.isArray(record.bridges) || record.bridges.length > 100) throw new Error('record.bridges must contain at most 100 bridges.')
  const bridges = record.bridges.map((value, index): MathematicalBridge => {
    const bridge = object(value, `record.bridges[${index}]`)
    const bridgeType = line(bridge.bridgeType, `record.bridges[${index}].bridgeType`) as MathematicalBridge['bridgeType']
    const bridgeId = line(bridge.id, `record.bridges[${index}].id`, 10, 180)
    if (!BRIDGE_ID.test(bridgeId) || !BRIDGE_TYPES.includes(bridgeType)) throw new Error(`record.bridges[${index}] has an invalid id or type.`)
    return {
      id: bridgeId,
      sourceConceptId: line(bridge.sourceConceptId, `record.bridges[${index}].sourceConceptId`, 10, 180),
      targetConceptId: line(bridge.targetConceptId, `record.bridges[${index}].targetConceptId`, 10, 180),
      bridgeType,
      statement: line(bridge.statement, `record.bridges[${index}].statement`, 10),
      ...(typeof bridge.formalAttachment === 'string' ? { formalAttachment: line(bridge.formalAttachment, `record.bridges[${index}].formalAttachment`) } : {}),
      ...(typeof bridge.epistemicWarning === 'string' ? { epistemicWarning: line(bridge.epistemicWarning, `record.bridges[${index}].epistemicWarning`) } : {}),
    }
  })

  const publication = object(record.publication, 'record.publication')
  if (publication.requestedPublicPromotion !== false || publication.reviewState !== 'draft') {
    throw new Error('Factory records must be non-promoted drafts.')
  }
  if (!Array.isArray(publication.reviewEvents) || publication.reviewEvents.length !== 0) {
    throw new Error('Factory drafts cannot carry review decisions.')
  }
  const requiredReviewScopes = Array.isArray(publication.requiredReviewScopes)
    ? stringArray(publication.requiredReviewScopes, 'record.publication.requiredReviewScopes', 1, 4) as EpistemicRecord['publication']['requiredReviewScopes']
    : undefined
  if (requiredReviewScopes?.some((scope) => !EXPERT_REVIEW_SCOPES.includes(scope))) throw new Error('record.publication.requiredReviewScopes contains an unsupported scope.')
  if (requiredReviewScopes && new Set(requiredReviewScopes).size !== requiredReviewScopes.length) throw new Error('record.publication.requiredReviewScopes cannot contain duplicates.')
  const parsed: EpistemicRecord = {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id,
    domainSlug,
    recordKind,
    slug,
    title: line(record.title, 'record.title', 3, 300),
    description: line(record.description, 'record.description', 20),
    summary: line(record.summary, 'record.summary', 20),
    claims,
    sources,
    sections,
    bridges,
    boundaries: stringArray(record.boundaries, 'record.boundaries', 1, 100),
    prohibitedInferences: stringArray(record.prohibitedInferences, 'record.prohibitedInferences', 1, 100),
    publication: {
      requestedPublicPromotion: false,
      reviewState: 'draft',
      canonicalVersion: line(publication.canonicalVersion, 'record.publication.canonicalVersion', 1, 64),
      lastReviewedAt: line(publication.lastReviewedAt, 'record.publication.lastReviewedAt', 20, 40),
      requiredReviewScopes,
      reviewEvents: [],
    },
  }
  // This call checks claim/source/section/bridge references and yields explicit
  // reasons. A draft is expected to fail only publication-workflow reasons.
  evaluatePublicationGate(parsed)
  return parsed
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'under', 'using', 'with'])
const NEGATION = /\b(?:cannot|does not|do not|fails? to|is not|no|not|without)\b/i

function tokens(statement: string): Set<string> {
  return new Set(statement.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((word) => right.has(word)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

export interface EpistemicConflictLead {
  kind: 'exact-duplicate' | 'polarity-conflict-candidate' | 'overlapping-claim'
  candidateClaimId: string
  existingRecordId: string
  existingClaimId: string
  lexicalSimilarity: number
  candidateStatement: string
  existingStatement: string
  requiresHumanAdjudication: true
}

export function detectEpistemicClaimConflicts(candidate: EpistemicRecord, existing: readonly EpistemicRecord[]): EpistemicConflictLead[] {
  const leads: EpistemicConflictLead[] = []
  for (const candidateClaim of candidate.claims) {
    const candidateNormalized = candidateClaim.statement.trim().toLowerCase().replace(/\s+/g, ' ')
    const candidateTokens = tokens(candidateClaim.statement)
    for (const record of existing) {
      if (record.id === candidate.id) continue
      for (const existingClaim of record.claims) {
        const existingNormalized = existingClaim.statement.trim().toLowerCase().replace(/\s+/g, ' ')
        const similarity = jaccard(candidateTokens, tokens(existingClaim.statement))
        const exact = candidateNormalized === existingNormalized
        const polarityMismatch = NEGATION.test(candidateClaim.statement) !== NEGATION.test(existingClaim.statement)
        const kind = exact ? 'exact-duplicate' as const
          : similarity >= 0.55 && polarityMismatch ? 'polarity-conflict-candidate' as const
            : similarity >= 0.75 ? 'overlapping-claim' as const
              : null
        if (!kind) continue
        leads.push({
          kind,
          candidateClaimId: candidateClaim.id,
          existingRecordId: record.id,
          existingClaimId: existingClaim.id,
          lexicalSimilarity: Number(similarity.toFixed(4)),
          candidateStatement: candidateClaim.statement,
          existingStatement: existingClaim.statement,
          requiresHumanAdjudication: true,
        })
      }
    }
  }
  return leads.sort((left, right) => right.lexicalSimilarity - left.lexicalSimilarity || left.existingRecordId.localeCompare(right.existingRecordId))
}

export interface BridgeContractFinding {
  bridgeId: string
  status: 'contract-passed' | 'blocked'
  reasons: string[]
  targetRecordId: string
  targetDomainSlug: string | null
  crossDomain: boolean | null
  proofVerified: false
}

export function verifyEpistemicBridgeContracts(candidate: EpistemicRecord, existing: readonly EpistemicRecord[]): BridgeContractFinding[] {
  const records = new Map([...existing, candidate].map((record) => [record.id, record]))
  return candidate.bridges.map((bridge) => {
    const reasons: string[] = []
    const target = records.get(bridge.targetConceptId)
    if (bridge.sourceConceptId !== candidate.id) reasons.push('bridge-source-does-not-match-candidate')
    if (!target) reasons.push('bridge-target-unresolved')
    if (bridge.sourceConceptId === bridge.targetConceptId) reasons.push('bridge-self-reference')
    if (bridge.bridgeType === 'mathematical-equivalence' && !bridge.formalAttachment?.trim()) reasons.push('formal-attachment-required')
    if (['structural-analogy', 'statistical-association'].includes(bridge.bridgeType) && !bridge.epistemicWarning?.trim()) reasons.push('epistemic-warning-required')
    return {
      bridgeId: bridge.id,
      status: reasons.length ? 'blocked' as const : 'contract-passed' as const,
      reasons,
      targetRecordId: bridge.targetConceptId,
      targetDomainSlug: target?.domainSlug ?? null,
      crossDomain: target ? target.domainSlug !== candidate.domainSlug : null,
      proofVerified: false as const,
    }
  })
}

export interface CompiledEpistemicDraft {
  schemaVersion: typeof EPISTEMIC_FACTORY_MCP_VERSION
  recordId: string
  sourcePublicPath: string
  candidateSha256: string
  reviewTargetSha256: string
  candidateSnapshot: EpistemicRecord
  automatedAudit: EpistemicCandidateAudit
  conflictLeads: EpistemicConflictLead[]
  bridgeContracts: BridgeContractFinding[]
  canonicalStatus: 'noncanonical-draft'
  indexControl: { crawlable: false; sitemapEligible: false; robotsDirective: 'noindex, nofollow, noarchive' }
  compiledAt: string
  compilationSha256: string
}

export function compileEpistemicDraft(
  recordValue: unknown,
  sourcePublicPathValue: unknown,
  existing: readonly EpistemicRecord[],
  compiledAt = new Date(),
): CompiledEpistemicDraft {
  const candidateSnapshot = parseEpistemicFactoryRecord(recordValue)
  const sourcePublicPath = line(sourcePublicPathValue, 'sourcePublicPath', 12, 300)
  if (!PUBLIC_PATH.test(sourcePublicPath)) throw new Error('sourcePublicPath must be a /knowledge path.')
  const unsigned = {
    schemaVersion: EPISTEMIC_FACTORY_MCP_VERSION,
    recordId: candidateSnapshot.id,
    sourcePublicPath,
    candidateSha256: sha256Canonical(candidateSnapshot),
    reviewTargetSha256: epistemicReviewTargetHash(candidateSnapshot),
    candidateSnapshot,
    automatedAudit: buildEpistemicCandidateAudit(candidateSnapshot, compiledAt),
    conflictLeads: detectEpistemicClaimConflicts(candidateSnapshot, existing),
    bridgeContracts: verifyEpistemicBridgeContracts(candidateSnapshot, existing),
    canonicalStatus: 'noncanonical-draft' as const,
    indexControl: { crawlable: false as const, sitemapEligible: false as const, robotsDirective: 'noindex, nofollow, noarchive' as const },
    compiledAt: compiledAt.toISOString(),
  }
  return { ...unsigned, compilationSha256: sha256Canonical(unsigned) }
}

export interface EpistemicFactoryQueueJob {
  schemaVersion: typeof EPISTEMIC_FACTORY_JOB_VERSION
  jobId: string
  operation: 'draft-node'
  status: 'queued'
  compilation: CompiledEpistemicDraft
  payloadSha256: string
  enqueuedAt: string
  jobBoundary: string
  jobSha256: string
}

export function buildEpistemicFactoryQueueJob(compilation: CompiledEpistemicDraft, enqueuedAt = new Date()): EpistemicFactoryQueueJob {
  const unsigned = {
    schemaVersion: EPISTEMIC_FACTORY_JOB_VERSION,
    jobId: `epifjob_${randomUUID().replaceAll('-', '')}`,
    operation: 'draft-node' as const,
    status: 'queued' as const,
    compilation,
    payloadSha256: compilation.compilationSha256,
    enqueuedAt: enqueuedAt.toISOString(),
    jobBoundary: 'A queued factory job may create an immutable noncanonical draft target. It cannot create a review decision, canonical release, sitemap entry, or crawlable candidate route.',
  }
  return { ...unsigned, jobSha256: sha256Canonical(unsigned) }
}

export const EPISTEMIC_FACTORY_MCP_TOOLS = [
  {
    name: 'factory_draft_node',
    title: 'Draft epistemic node',
    description: 'Compile a structured maha-epistemic/1.0 record into an audited noncanonical draft preview. Queue submission remains an explicit admin operation and this tool never publishes.',
    authorityLevel: 'authenticated-operations',
    readOnly: true,
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['record', 'sourcePublicPath'],
      properties: {
        record: { type: 'object', description: 'A complete non-promoted maha-epistemic/1.0 record with no review events.' },
        sourcePublicPath: { type: 'string', pattern: '^/knowledge/' },
      },
    },
  },
  {
    name: 'factory_detect_conflict',
    title: 'Detect claim conflicts',
    description: 'Compare a structured draft against current static and persisted records. Returns lexical duplicate, overlap, and polarity-mismatch leads; it does not adjudicate truth.',
    authorityLevel: 'authenticated-operations',
    readOnly: true,
    inputSchema: { type: 'object', additionalProperties: false, required: ['record'], properties: { record: { type: 'object' } } },
  },
  {
    name: 'factory_verify_bridge',
    title: 'Verify bridge contract',
    description: 'Validate proposed bridge targets, types, formal-attachment requirements, and analogy warnings. Structural validation is not mathematical proof or empirical confirmation.',
    authorityLevel: 'authenticated-operations',
    readOnly: true,
    inputSchema: { type: 'object', additionalProperties: false, required: ['record'], properties: { record: { type: 'object' } } },
  },
] as const
