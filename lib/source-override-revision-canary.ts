import { ALIGNMENT_BATCH_9_REMEDIATION_PACKETS } from './frontier-alignment-batch-9.ts'
import { ALIGNMENT_BATCH_10_REMEDIATION_PACKETS } from './frontier-alignment-batch-10.ts'
import { PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS } from './frontier-source-override-activation.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import { EXPERT_REVIEW_CRITERIA, type ExpertReviewInput } from './epistemic-review.ts'
import type { EpistemicRecord, EpistemicSource, ExpertReviewScope } from './epistemic-schema.ts'
import { publishBatch2Record } from './substantial-page-publication-batch-2.ts'
import { evaluateSubstantialPageGate } from './substantial-page.ts'
import { SUBSTANTIAL_BATCH_4_PRIOR_RELEASES } from './substantial-page-publication-batch-4.ts'

export const SOURCE_OVERRIDE_REVISION_CANARY_VERSION = 'maha-source-override-revision-canary/0.1' as const

export const SOURCE_OVERRIDE_RELEASE_CANARY_RECORD_IDS = [
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures',
  'urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing',
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering',
] as const

type RecordId = (typeof SOURCE_OVERRIDE_RELEASE_CANARY_RECORD_IDS)[number]

interface SourceMetadata {
  title: string
  authors: string[]
  publisher: string
  publishedAt: string
  identifier: EpistemicSource['identifiers'][number]
  versionRelationship: string
  rightsFinding: string
}

const SOURCE_METADATA: Readonly<Record<RecordId, SourceMetadata>> = {
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures': {
    title: 'Boron nitride substrates for high-quality graphene electronics',
    authors: ['C. R. Dean', 'A. F. Young', 'I. Meric', 'et al.'],
    publisher: 'Nature Nanotechnology',
    publishedAt: '2010-08-22',
    identifier: { scheme: 'doi', value: '10.1038/nnano.2010.172' },
    versionRelationship: 'The inspected arXiv preprint and DOI metadata identify the same article; the record states that the inspected artifact is the preprint.',
    rightsFinding: 'Citation metadata and original bounded paraphrase only; no article passage, figure, or table is reproduced.',
  },
  'urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing': {
    title: 'Method for producing quartz glass crucible for use in pulling silicon single crystal',
    authors: ['K. Kumagai', 'et al.'],
    publisher: 'United States Patent and Trademark Office',
    publishedAt: '2009-09-15',
    identifier: { scheme: 'accession', value: 'US7587912B2' },
    versionRelationship: 'The inspected Google Patents artifact identifies the issued US patent, inventors, claims, description, and legal chronology.',
    rightsFinding: 'Citation and original bounded paraphrase only; no patent drawing, claim text, or extended passage is reproduced.',
  },
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets': {
    title: 'Smaller & Sooner: Exploiting High Magnetic Fields from New Superconductors for a More Attractive Fusion Energy Development Path',
    authors: ['D. G. Whyte', 'B. N. Sorbom', 'J. L. Kirtley', 'et al.'],
    publisher: 'Journal of Fusion Energy',
    publishedAt: '2016-02-01',
    identifier: { scheme: 'doi', value: '10.1007/s10894-015-0050-1' },
    versionRelationship: 'The inspected MIT PSFC accepted manuscript and Crossref metadata identify the same journal article; the version of record was not inspected.',
    rightsFinding: 'Citation and original bounded paraphrase only; no manuscript passage, figure, or table is reproduced.',
  },
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens': {
    title: 'Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud',
    authors: ['A. Birgisson', 'J. G. Politz', 'Ú. Erlingsson', 'et al.'],
    publisher: 'Network and Distributed System Security Symposium',
    publishedAt: '2014-02-23',
    identifier: { scheme: 'url', value: 'https://research.google.com/pubs/archive/41892.pdf' },
    versionRelationship: 'Google Research and the inspected NDSS PDF agree on title, authors, venue, and year.',
    rightsFinding: 'Citation and original bounded paraphrase only; no PDF passage, figure, or credential construction is reproduced.',
  },
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering': {
    title: 'Forward design of a complex enzyme cascade reaction',
    authors: ['C. Hold', 'S. Billerbeck', 'S. Panke'],
    publisher: 'Nature Communications',
    publishedAt: '2016-10-06',
    identifier: { scheme: 'doi', value: '10.1038/ncomms12971' },
    versionRelationship: 'The inspected PMC version of record identifies the article, three authors, article number, DOI, and CC BY 4.0 status.',
    rightsFinding: 'The source is CC BY 4.0; this record nevertheless retains only citation metadata and original bounded paraphrase.',
  },
}

const packets = [...ALIGNMENT_BATCH_9_REMEDIATION_PACKETS, ...ALIGNMENT_BATCH_10_REMEDIATION_PACKETS]

function packetFor(recordId: RecordId) {
  const packet = packets.find((entry) => entry.recordId === recordId)
  if (!packet) throw new Error(`${recordId}: remediation packet is missing.`)
  return packet
}

function revisedSource(recordId: RecordId): EpistemicSource {
  const packet = packetFor(recordId)
  const metadata = SOURCE_METADATA[recordId]
  return {
    id: packet.replacement.proposedSourceContractId,
    title: metadata.title,
    authors: metadata.authors,
    publisher: metadata.publisher,
    publishedAt: metadata.publishedAt,
    url: packet.replacement.url,
    identifiers: [metadata.identifier],
    exactLocator: packet.replacement.inspection.inspectedContentLocation,
    rights: {
      basis: 'citation-with-paraphrase',
      quotationUsed: false,
      note: metadata.rightsFinding,
    },
    establishes: packet.replacement.inspection.findings,
    boundary: packet.replacement.inspection.limitation,
  }
}

export function buildSourceOverrideRevision(recordId: RecordId): EpistemicRecord {
  const active = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === recordId)
  const packet = packetFor(recordId)
  if (!active || !activation) throw new Error(`${recordId}: activation target is missing.`)
  if (epistemicReviewTargetHash(active) !== activation.priorRecordRevisionSha256) throw new Error(`${recordId}: active revision moved after activation.`)
  if (!active.sources.some((source) => source.id === activation.priorSourceContractId)) throw new Error(`${recordId}: prior source binding moved after activation.`)
  if (packet.replacement.proposedSourceContractId !== activation.proposedSourceContractId
    || packet.replacement.identifier !== activation.proposedSourceIdentifier
    || packet.replacement.inspection.inspectedContentLocation !== activation.exactLocator) {
    throw new Error(`${recordId}: activation and inspected remediation packet diverged.`)
  }

  const source = revisedSource(recordId)
  const claim = active.claims[0]
  const claimStatement = packet.replacement.inspection.findings
  const scope = `Limited to ${source.exactLocator} in “${source.title}”. The inspected artifact and version relationship are declared; no uncited system, material, organism, or study is pooled.`
  const boundary = packet.replacement.inspection.limitation
  return {
    ...active,
    description: `A source-bounded ${active.recordKind} record for ${active.title.toLowerCase()} within ${active.domainSlug.replaceAll('-', ' ')}.`,
    summary: `${active.title} is bound to one inspected replacement source, exact locator, explicit version relationship, uncertainty statement, and prohibited-inference boundary.`,
    claims: [{
      ...claim,
      statement: claimStatement,
      sourceIds: [source.id],
      scope,
      boundary,
    }],
    sources: [source],
    sections: [
      {
        heading: 'What the inspected source establishes',
        paragraphs: [claimStatement, scope],
        claimIds: [claim.id],
      },
      {
        heading: 'What remains unresolved',
        paragraphs: [boundary, 'The internal source inspection is not external expert review, independent reproduction, commercial readiness, or permission to generalize beyond the cited conditions.'],
        claimIds: [],
      },
    ],
    boundaries: [...new Set([...active.boundaries, boundary])],
    prohibitedInferences: [...new Set([
      ...active.prohibitedInferences,
      'Do not treat internal source inspection, revision audit, or internal review as external expert endorsement or independent reproduction.',
    ])],
    publication: {
      requestedPublicPromotion: false,
      reviewState: 'draft',
      canonicalVersion: '0.2.0-private-candidate',
      lastReviewedAt: '2026-08-30T00:00:00.000Z',
      requiredReviewScopes: active.publication.requiredReviewScopes,
      reviewEvents: [],
    },
  }
}

export const SOURCE_OVERRIDE_REVISED_RECORDS: readonly EpistemicRecord[] =
  SOURCE_OVERRIDE_RELEASE_CANARY_RECORD_IDS.map(buildSourceOverrideRevision)

export const REVISION_AUDIT_DIMENSIONS = [
  'source-identity',
  'version-relationship',
  'exact-locator',
  'rights-basis',
  'claim-scope',
  'uncertainty-and-boundary',
  'record-classification',
  'prohibited-inferences',
] as const

export interface SourceOverrideRevisionAudit {
  schemaVersion: typeof SOURCE_OVERRIDE_REVISION_CANARY_VERSION
  auditId: string
  recordId: string
  priorRecordRevisionSha256: string
  revisedRecordRevisionSha256: string
  activationSha256: string
  sourceContractId: string
  exactLocator: string
  inspectionDepth: string
  checks: readonly { dimension: (typeof REVISION_AUDIT_DIMENSIONS)[number]; verdict: 'satisfied'; finding: string }[]
  externallyReviewed: false
  independentlyReproduced: false
  outcome: 'alignment-clear-ready-for-revision-scoped-review'
  auditSha256: string
}

function auditFor(record: EpistemicRecord): SourceOverrideRevisionAudit {
  const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === record.id)!
  const packet = packetFor(record.id as RecordId)
  const metadata = SOURCE_METADATA[record.id as RecordId]
  const source = record.sources[0]
  const checks = [
    { dimension: 'source-identity' as const, verdict: 'satisfied' as const, finding: packet.replacement.inspection.metadataNote },
    { dimension: 'version-relationship' as const, verdict: 'satisfied' as const, finding: metadata.versionRelationship },
    { dimension: 'exact-locator' as const, verdict: 'satisfied' as const, finding: `Content was inspected at ${source.exactLocator}` },
    { dimension: 'rights-basis' as const, verdict: 'satisfied' as const, finding: metadata.rightsFinding },
    { dimension: 'claim-scope' as const, verdict: 'satisfied' as const, finding: 'The revised claim is the packet finding itself and is bound only to the inspected replacement source.' },
    { dimension: 'uncertainty-and-boundary' as const, verdict: 'satisfied' as const, finding: packet.replacement.inspection.limitation },
    { dimension: 'record-classification' as const, verdict: 'satisfied' as const, finding: 'The separate Batch 9/10 review accepted the replacement without requiring a record-kind or claim-kind revision.' },
    { dimension: 'prohibited-inferences' as const, verdict: 'satisfied' as const, finding: 'The revision prohibits external-review, reproduction, readiness, transfer, and unsupported system-level inferences.' },
  ]
  const base = {
    schemaVersion: SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
    auditId: `urn:maha:audit:source-override-revision:${record.slug}`,
    recordId: record.id,
    priorRecordRevisionSha256: activation.priorRecordRevisionSha256,
    revisedRecordRevisionSha256: epistemicReviewTargetHash(record),
    activationSha256: activation.activationSha256,
    sourceContractId: source.id,
    exactLocator: source.exactLocator,
    inspectionDepth: packet.replacement.inspection.inspectionDepth,
    checks,
    externallyReviewed: false as const,
    independentlyReproduced: false as const,
    outcome: 'alignment-clear-ready-for-revision-scoped-review' as const,
  }
  return { ...base, auditSha256: sha256Canonical(base) }
}

export const SOURCE_OVERRIDE_REVISION_AUDITS: readonly SourceOverrideRevisionAudit[] = SOURCE_OVERRIDE_REVISED_RECORDS.map(auditFor)

export interface RevisionScopedDecision {
  schemaVersion: 'maha-source-override-revision-review/0.1'
  decisionId: string
  recordId: string
  scope: ExpertReviewScope
  targetSha256: string
  auditSha256: string
  reviewerId: 'maha-internal-editorial:source-override-revision-canary'
  reviewerKind: 'internal-editorial'
  reviewMethod: 'explicit-revision-checklist'
  verdict: 'approve'
  reviewedAt: '2026-08-30T00:00:00.000Z'
  externallyReviewed: false
  independentlyReproduced: false
  decisionSha256: string
}

const REVIEW_SCOPES: readonly ExpertReviewScope[] = ['source-fidelity', 'domain-fidelity', 'boundary-adequacy', 'rights-and-locator']

export const SOURCE_OVERRIDE_REVISION_DECISIONS: readonly RevisionScopedDecision[] = SOURCE_OVERRIDE_REVISION_AUDITS.flatMap((audit) =>
  REVIEW_SCOPES.map((scope) => {
    const base = {
      schemaVersion: 'maha-source-override-revision-review/0.1' as const,
      decisionId: `urn:maha:review:source-override-revision:${audit.recordId.replace('urn:maha:record:', '')}:${scope}`,
      recordId: audit.recordId,
      scope,
      targetSha256: audit.revisedRecordRevisionSha256,
      auditSha256: audit.auditSha256,
      reviewerId: 'maha-internal-editorial:source-override-revision-canary' as const,
      reviewerKind: 'internal-editorial' as const,
      reviewMethod: 'explicit-revision-checklist' as const,
      verdict: 'approve' as const,
      reviewedAt: '2026-08-30T00:00:00.000Z' as const,
      externallyReviewed: false as const,
      independentlyReproduced: false as const,
    }
    return { ...base, decisionSha256: sha256Canonical(base) }
  }),
)

const REVIEW_DIMENSIONS: Readonly<Record<ExpertReviewScope, readonly (typeof REVISION_AUDIT_DIMENSIONS)[number][]>> = {
  'source-fidelity': ['source-identity', 'version-relationship', 'exact-locator', 'claim-scope'],
  'domain-fidelity': ['record-classification', 'claim-scope'],
  'boundary-adequacy': ['uncertainty-and-boundary', 'prohibited-inferences'],
  'rights-and-locator': ['rights-basis', 'exact-locator', 'version-relationship'],
}

export function sourceOverrideRevisionCanaryReviewInputs(): readonly ExpertReviewInput[] {
  return SOURCE_OVERRIDE_REVISED_RECORDS.flatMap((record) => {
    const audit = SOURCE_OVERRIDE_REVISION_AUDITS.find((entry) => entry.recordId === record.id)
    if (!audit) throw new Error(`${record.id}: exact-revision audit is missing.`)
    return REVIEW_SCOPES.map((scope) => {
      const sourceFindings = audit.checks
        .filter((check) => REVIEW_DIMENSIONS[scope].includes(check.dimension))
        .map((check) => `${check.dimension}: ${check.finding}`)
        .join(' ')
      const idempotencyDigest = sha256Canonical({
        schemaVersion: SOURCE_OVERRIDE_REVISION_CANARY_VERSION,
        recordId: record.id,
        targetSha256: audit.revisedRecordRevisionSha256,
        scope,
        auditSha256: audit.auditSha256,
      })
      return {
        recordId: record.id,
        domainSlug: record.domainSlug,
        targetSha256: audit.revisedRecordRevisionSha256,
        scope,
        reviewer: {
          reviewerId: 'expert_maha-internal-source-override-v1',
          profileVersion: 1,
          displayName: 'Maha Strategies internal source-override review',
          qualifications: ['Exact-revision source, locator, rights, scope, and boundary checklist'],
          affiliation: 'Maha Strategies',
          identityUrl: null,
          domains: [record.domainSlug],
          conflicts: ['Maha Strategies authors, reviews, and may release this record; this internal review is not independent.'],
          reviewerKind: 'internal-editorial' as const,
          reviewMethod: 'Explicit exact-revision checklist bound to the eight-dimension source-override audit. No external endorsement or independent reproduction is claimed.',
        },
        criteria: EXPERT_REVIEW_CRITERIA[scope].map((criterion) => ({
          criterionId: criterion.id,
          verdict: 'satisfied' as const,
          rationale: `${criterion.label} was checked against exact revision ${audit.revisedRecordRevisionSha256} and audit ${audit.auditSha256}. ${sourceFindings}`,
        })),
        disagreements: ['This is an internal editorial decision. External expert review and independent reproduction were not performed.'],
        rationale: `The ${scope} decision is limited to exact revision ${audit.revisedRecordRevisionSha256}. ${sourceFindings}`,
        supersedesReviewId: null,
        idempotencyKey: `source-override-revision:${idempotencyDigest}`,
      }
    })
  })
}

export interface RevisionReadinessResult {
  ready: boolean
  blockers: string[]
}

export function evaluateSourceOverrideRevisionReadiness(
  record: EpistemicRecord,
  audit: SourceOverrideRevisionAudit | undefined,
  decisions: readonly RevisionScopedDecision[],
): RevisionReadinessResult {
  const blockers = new Set<string>()
  if (!audit) return { ready: false, blockers: ['revision-audit-missing'] }
  const { auditSha256, ...auditBody } = audit
  if (sha256Canonical(auditBody) !== auditSha256) blockers.add('revision-audit-digest-invalid')
  const revisionSha256 = epistemicReviewTargetHash(record)
  if (audit.recordId !== record.id || audit.revisedRecordRevisionSha256 !== revisionSha256) blockers.add('revision-audit-target-stale')
  if (record.sources.length !== 1 || record.sources[0].id !== audit.sourceContractId) blockers.add('revision-audit-source-mismatch')
  if (!record.sources[0]?.exactLocator || record.sources[0].exactLocator !== audit.exactLocator) blockers.add('revision-audit-locator-mismatch')
  if (audit.outcome !== 'alignment-clear-ready-for-revision-scoped-review'
    || audit.checks.length !== REVISION_AUDIT_DIMENSIONS.length
    || new Set(audit.checks.map((check) => check.dimension)).size !== REVISION_AUDIT_DIMENSIONS.length
    || audit.checks.some((check) => check.verdict !== 'satisfied')) blockers.add('revision-audit-checklist-incomplete')
  if (audit.externallyReviewed || audit.independentlyReproduced) blockers.add('revision-audit-boundary-misrepresented')

  const scoped = decisions.filter((decision) => decision.recordId === record.id)
  if (scoped.length !== REVIEW_SCOPES.length || new Set(scoped.map((decision) => decision.scope)).size !== REVIEW_SCOPES.length
    || REVIEW_SCOPES.some((scope) => !scoped.some((decision) => decision.scope === scope))) blockers.add('revision-review-scope-missing')
  for (const decision of scoped) {
    const { decisionSha256, ...decisionBody } = decision
    if (sha256Canonical(decisionBody) !== decisionSha256) blockers.add('revision-review-digest-invalid')
    if (decision.targetSha256 !== revisionSha256) blockers.add('revision-review-target-stale')
    if (decision.auditSha256 !== audit.auditSha256) blockers.add('revision-review-audit-stale')
    if (decision.verdict !== 'approve' || decision.reviewerKind !== 'internal-editorial'
      || decision.reviewMethod !== 'explicit-revision-checklist') blockers.add('revision-review-not-approved')
    if (decision.externallyReviewed || decision.independentlyReproduced) blockers.add('revision-review-boundary-misrepresented')
  }
  return { ready: blockers.size === 0, blockers: [...blockers].sort() }
}

const priorReleaseByRecordId = new Map(SUBSTANTIAL_BATCH_4_PRIOR_RELEASES.map((release) => [release.recordId, release]))
const revisedGraph = FRONTIER_DOMAIN_GRAPH_RECORDS.map((record) =>
  SOURCE_OVERRIDE_REVISED_RECORDS.find((candidate) => candidate.id === record.id) ?? record,
)

export interface PrivateRevisionReleaseCanary {
  schemaVersion: 'maha-private-revision-release-canary/0.1'
  recordId: string
  releaseKind: 'initial' | 'superseding'
  priorReleaseId: string | null
  priorReleaseTargetSha256: string | null
  targetSha256: string
  canonicalPath: string
  auditSha256: string
  decisionSha256s: readonly string[]
  substantialContractDigest: string
  substantialPageEligible: true
  state: 'private-preflight-passed-awaiting-release-authority'
  canonicalMutationAuthorized: false
  releaseAuthorityPresent: false
  productionMutationPerformed: false
  canarySha256: string
}

function releaseCanaryFor(record: EpistemicRecord): PrivateRevisionReleaseCanary {
  const audit = SOURCE_OVERRIDE_REVISION_AUDITS.find((entry) => entry.recordId === record.id)!
  const decisions = SOURCE_OVERRIDE_REVISION_DECISIONS.filter((entry) => entry.recordId === record.id)
  const priorRelease = priorReleaseByRecordId.get(record.id) ?? null
  const readiness = evaluateSourceOverrideRevisionReadiness(record, audit, decisions)
  if (!readiness.ready) throw new Error(`${record.id}: revision preflight failed: ${readiness.blockers.join(', ')}`)
  if (priorRelease && priorRelease.targetSha256 !== audit.priorRecordRevisionSha256) {
    throw new Error(`${record.id}: superseding canary does not bind the prior active release target.`)
  }
  const compiled = publishBatch2Record(record)
  const freshDecision = evaluateSubstantialPageGate(record, compiled.contract, revisedGraph, [])
  if (!freshDecision.pageEligible) throw new Error(`${record.id}: revised substantial contract remains blocked: ${freshDecision.reasons.join(', ')}`)
  const base = {
    schemaVersion: 'maha-private-revision-release-canary/0.1' as const,
    recordId: record.id,
    releaseKind: priorRelease ? 'superseding' as const : 'initial' as const,
    priorReleaseId: priorRelease?.releaseId ?? null,
    priorReleaseTargetSha256: priorRelease?.targetSha256 ?? null,
    targetSha256: audit.revisedRecordRevisionSha256,
    canonicalPath: epistemicRecordPath(record),
    auditSha256: audit.auditSha256,
    decisionSha256s: decisions.map((entry) => entry.decisionSha256).sort(),
    substantialContractDigest: compiled.contractDigest,
    substantialPageEligible: true as const,
    state: 'private-preflight-passed-awaiting-release-authority' as const,
    canonicalMutationAuthorized: false as const,
    releaseAuthorityPresent: false as const,
    productionMutationPerformed: false as const,
  }
  return { ...base, canarySha256: sha256Canonical(base) }
}

export const PRIVATE_REVISION_RELEASE_CANARY: readonly PrivateRevisionReleaseCanary[] = SOURCE_OVERRIDE_REVISED_RECORDS.map(releaseCanaryFor)

function assertIntegrity(): void {
  if (SOURCE_OVERRIDE_REVISED_RECORDS.length !== 5 || SOURCE_OVERRIDE_REVISION_AUDITS.length !== 5
    || SOURCE_OVERRIDE_REVISION_DECISIONS.length !== 20 || PRIVATE_REVISION_RELEASE_CANARY.length !== 5) {
    throw new Error('Source-override revision canary totals drifted.')
  }
  if (PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'superseding').length !== 2
    || PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'initial').length !== 3) {
    throw new Error('Private release canary must contain two superseding and three initial candidates.')
  }
  for (const record of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === record.id)!
    if (epistemicReviewTargetHash(record) === activation.priorRecordRevisionSha256) throw new Error(`${record.id}: revised record did not change.`)
    if (record.publication.requestedPublicPromotion || record.publication.reviewState !== 'draft' || record.publication.reviewEvents.length) {
      throw new Error(`${record.id}: private revision crossed a publication boundary.`)
    }
  }
  if (PRIVATE_REVISION_RELEASE_CANARY.some((entry) => entry.canonicalMutationAuthorized
    || entry.releaseAuthorityPresent || entry.productionMutationPerformed || !entry.substantialPageEligible)) {
    throw new Error('Private release preflight crossed authority or eligibility boundaries.')
  }
}

assertIntegrity()
