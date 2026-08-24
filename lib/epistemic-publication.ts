import { createHash } from 'node:crypto'

import {
  EPISTEMIC_SCHEMA_VERSION,
  type EpistemicRecord,
  type PublicationDecision,
  type ProvenanceBundle,
} from './epistemic-schema.ts'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const URN = /^urn:maha:(?:record|claim|bridge):[a-z0-9]+(?:-[a-z0-9]+)*$/

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForCanonicalJson(entry)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value))
}

export function sha256Canonical(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}

export function recordKindSegment(record: Pick<EpistemicRecord, 'recordKind'>): string {
  const irregular: Partial<Record<EpistemicRecord['recordKind'], string>> = {
    hypothesis: 'hypotheses',
  }
  return irregular[record.recordKind] ?? `${record.recordKind}s`
}

export function epistemicRecordPath(record: Pick<EpistemicRecord, 'domainSlug' | 'recordKind' | 'slug'>): string {
  return `/knowledge/${record.domainSlug}/${recordKindSegment(record as Pick<EpistemicRecord, 'recordKind'>)}/${record.slug}`
}

export function epistemicProvenancePath(record: Pick<EpistemicRecord, 'domainSlug' | 'recordKind' | 'slug'>): string {
  return `${epistemicRecordPath(record)}/provenance.json`
}

export function evaluatePublicationGate(record: EpistemicRecord): PublicationDecision {
  const reasons: string[] = []
  const sourceIds = new Set(record.sources.map((source) => source.id))
  const claimIds = new Set(record.claims.map((claim) => claim.id))

  if (record.schemaVersion !== EPISTEMIC_SCHEMA_VERSION) reasons.push('schema-version-mismatch')
  if (!URN.test(record.id)) reasons.push('invalid-record-id')
  if (!SLUG.test(record.domainSlug) || !SLUG.test(record.slug)) reasons.push('invalid-slug')
  if (!record.publication.requestedPublicPromotion) reasons.push('public-promotion-not-requested')
  if (record.publication.reviewState !== 'published-canonical') reasons.push('review-state-not-canonical')
  if (!record.publication.publishedAt) reasons.push('publication-date-missing')
  if (!record.publication.canonicalVersion.trim()) reasons.push('canonical-version-missing')
  if (!record.publication.reviewEvents.some((event) => event.verdict === 'approve')) reasons.push('approval-review-missing')
  if (!record.claims.length) reasons.push('claims-missing')
  if (!record.sources.length) reasons.push('sources-missing')
  if (!record.sections.length) reasons.push('sections-missing')
  if (!record.boundaries.length) reasons.push('boundaries-missing')
  if (!record.prohibitedInferences.length) reasons.push('prohibited-inferences-missing')

  if (sourceIds.size !== record.sources.length) reasons.push('duplicate-source-id')
  if (claimIds.size !== record.claims.length) reasons.push('duplicate-claim-id')

  for (const source of record.sources) {
    if (!source.url.startsWith('https://')) reasons.push(`source-url-invalid:${source.id}`)
    if (!source.identifiers.length) reasons.push(`source-identifier-missing:${source.id}`)
    if (!source.exactLocator.trim()) reasons.push(`source-locator-missing:${source.id}`)
    if (!source.rights.note.trim()) reasons.push(`source-rights-note-missing:${source.id}`)
    if (source.rights.quotationUsed && source.rights.basis === 'citation-with-paraphrase') {
      reasons.push(`quotation-exceeds-rights-basis:${source.id}`)
    }
    if (!source.establishes.trim() || !source.boundary.trim()) reasons.push(`source-scope-incomplete:${source.id}`)
  }

  for (const claim of record.claims) {
    if (!URN.test(claim.id)) reasons.push(`invalid-claim-id:${claim.id}`)
    if (!claim.sourceIds.length) reasons.push(`claim-source-missing:${claim.id}`)
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) reasons.push(`claim-source-unresolved:${claim.id}:${sourceId}`)
    }
    if (!claim.scope.trim() || !claim.boundary.trim()) reasons.push(`claim-scope-incomplete:${claim.id}`)
    if (!claim.uncertainty.statement.trim()) reasons.push(`claim-uncertainty-missing:${claim.id}`)
    if (!claim.replication.assessment.trim()) reasons.push(`claim-replication-missing:${claim.id}`)
  }

  for (const section of record.sections) {
    if (!section.paragraphs.length) reasons.push(`section-content-missing:${section.heading}`)
    for (const claimId of section.claimIds) {
      if (!claimIds.has(claimId)) reasons.push(`section-claim-unresolved:${claimId}`)
    }
  }

  for (const bridge of record.bridges) {
    if (!URN.test(bridge.id)) reasons.push(`invalid-bridge-id:${bridge.id}`)
    if (
      ['structural-analogy', 'statistical-association'].includes(bridge.bridgeType)
      && !bridge.epistemicWarning?.trim()
    ) reasons.push(`bridge-warning-missing:${bridge.id}`)
    if (bridge.bridgeType === 'mathematical-equivalence' && !bridge.formalAttachment?.trim()) {
      reasons.push(`formal-attachment-missing:${bridge.id}`)
    }
  }

  return {
    recordId: record.id,
    publicEligible: reasons.length === 0,
    evaluatedAgainst: EPISTEMIC_SCHEMA_VERSION,
    reasons,
  }
}

export function assertGraphIntegrity(records: readonly EpistemicRecord[]): void {
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate epistemic record id: ${record.id}`)
    ids.add(record.id)
    const path = epistemicRecordPath(record)
    if (paths.has(path)) throw new Error(`Duplicate epistemic record path: ${path}`)
    paths.add(path)
  }
}

export function buildProvenanceBundle(record: EpistemicRecord): ProvenanceBundle {
  const decision = evaluatePublicationGate(record)
  return {
    schemaVersion: record.schemaVersion,
    evidencePolicyVersion: record.evidencePolicyVersion,
    recordId: record.id,
    canonicalPath: epistemicRecordPath(record),
    contentHash: sha256Canonical(record),
    generatedAt: record.publication.lastReviewedAt,
    publicationDecision: decision,
    claims: record.claims,
    sources: record.sources,
    reviewEvents: record.publication.reviewEvents,
  }
}
