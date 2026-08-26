import type { EpistemicClaim, EpistemicRecord, EpistemicSource } from '../epistemic-schema.ts'
import { EPISTEMIC_RECORDS } from '../epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../epistemic-publication.ts'
import { alignmentBlockers } from '../frontier-source-alignment.ts'
import {
  substantialPageContractDigest,
  type CompiledSubstantialPage,
} from '../substantial-page-compiler.ts'
import { evaluateSubstantialPageGate } from '../substantial-page.ts'
import { compileEvidenceDossier, type EvidenceDossierDraft } from './compiler.ts'
import type {
  ClaimType,
  DossierPassage,
  DossierReviewState,
  EvidenceDossier,
  ExtractionMethod,
} from './schema.ts'

export const SUBSTANTIAL_PAGE_DOSSIER_ADAPTER_VERSION = 'maha-substantial-page-dossier-adapter/0.1' as const

export interface InspectedSourceAttestation {
  sourceId: string
  verifiedAt: string
  metadataProvenance: string
  extractionMethod: Exclude<ExtractionMethod, 'not-extracted'>
  passages: readonly {
    passageId: string
    claimIds: readonly string[]
    locator: string
    locatorKind: DossierPassage['locatorKind']
    excerpt: string
    isParaphrase: boolean
    sourceRevision: string
  }[]
}

export interface SubstantialPageDossierInput {
  record: EpistemicRecord
  compiledPage: CompiledSubstantialPage
  attestations: readonly InspectedSourceAttestation[]
  dossierId: string
  generatedAt: string
  corpusRevision: string
  reviewState: DossierReviewState
  intendedUse: string
  methodology: string
  prohibitedUses: readonly string[]
  limitations: readonly string[]
  disclaimer: string
}

function claimType(claim: EpistemicClaim): ClaimType {
  if (claim.claimKind === 'empirical-claim' || claim.claimKind === 'observation') return 'empirical-measurement'
  if (claim.claimKind === 'theoretical-model' || claim.claimKind === 'hypothesis') return 'modelled-result'
  return 'definition'
}

function rightsBasis(source: EpistemicSource): string {
  const license = source.rights.licenseName ? `; ${source.rights.licenseName}` : ''
  return `${source.rights.basis}${license}; ${source.rights.note}`
}

function citedIds(page: CompiledSubstantialPage): { claimIds: Set<string>; sourceIds: Set<string> } {
  const claimIds = new Set(page.contract.directAnswer.claimIds)
  const sourceIds = new Set(page.contract.directAnswer.sourceIds)
  for (const section of page.contract.explanations) {
    section.claimIds.forEach((id) => claimIds.add(id))
    section.sourceIds.forEach((id) => sourceIds.add(id))
  }
  for (const axis of page.contract.comparison.axes) {
    axis.claimIds.forEach((id) => claimIds.add(id))
    axis.sourceIds.forEach((id) => sourceIds.add(id))
  }
  page.contract.calculation.claimIds.forEach((id) => claimIds.add(id))
  page.contract.calculation.sourceIds.forEach((id) => sourceIds.add(id))
  return { claimIds, sourceIds }
}

/**
 * Converts only an eligible substantial-page contract with explicit inspected
 * passages. It performs no retrieval and never turns a locator into evidence.
 */
export function adaptSubstantialPageToDossier(input: SubstantialPageDossierInput): EvidenceDossier {
  const { record, compiledPage } = input
  const canonicalRecord = EPISTEMIC_RECORDS.find((entry) => entry.id === record.id)
  if (!canonicalRecord) throw new Error('Substantial page is blocked: alignment-audit-missing; canonical record unavailable.')
  const canonicalRevision = epistemicReviewTargetHash(canonicalRecord)
  if (epistemicReviewTargetHash(record) !== canonicalRevision) throw new Error('Substantial page record is stale or differs from the canonical record.')
  if (compiledPage.contract.recordId !== record.id || compiledPage.decision.recordId !== record.id) throw new Error('Substantial page and record do not match.')
  if (compiledPage.contract.recordRevisionSha256 !== canonicalRevision) throw new Error('Substantial page record revision is stale.')
  const expectedDigest = substantialPageContractDigest(compiledPage.contract)
  if (compiledPage.contractDigest !== expectedDigest) throw new Error('Substantial page contract digest mismatch.')

  const expectedDecision = evaluateSubstantialPageGate(
    canonicalRecord,
    compiledPage.contract,
    EPISTEMIC_RECORDS,
    alignmentBlockers(record.id),
  )
  const normalizedExpected = { ...expectedDecision, reasons: [...expectedDecision.reasons].sort() }
  const normalizedSupplied = { ...compiledPage.decision, reasons: [...compiledPage.decision.reasons].sort() }
  if (JSON.stringify(normalizedSupplied) !== JSON.stringify(normalizedExpected)) {
    throw new Error('Substantial page decision does not match independent gate evaluation.')
  }
  if (!normalizedExpected.pageEligible) throw new Error(`Substantial page is blocked: ${normalizedExpected.reasons.join(', ')}`)

  const cited = citedIds(compiledPage)
  const claimsById = new Map(record.claims.map((claim) => [claim.id, claim]))
  const sourcesById = new Map(record.sources.map((source) => [source.id, source]))
  const attestations = new Map(input.attestations.map((attestation) => [attestation.sourceId, attestation]))
  if (attestations.size !== input.attestations.length) throw new Error('Duplicate source attestation.')

  for (const claimId of cited.claimIds) if (!claimsById.has(claimId)) throw new Error(`Unresolved cited claim: ${claimId}`)
  for (const sourceId of cited.sourceIds) {
    if (!sourcesById.has(sourceId)) throw new Error(`Unresolved cited source: ${sourceId}`)
    if (!attestations.has(sourceId)) throw new Error(`Inspected-source attestation missing: ${sourceId}`)
  }

  const passages = input.attestations.flatMap((attestation) => attestation.passages.map((passage) => {
    if (passage.claimIds.length === 0) throw new Error(`${passage.passageId}: passage must bind at least one claim.`)
    for (const claimId of passage.claimIds) {
      const claim = claimsById.get(claimId)
      if (!claim || !cited.claimIds.has(claimId)) throw new Error(`${passage.passageId}: unresolved or uncited claim ${claimId}.`)
      if (!claim.sourceIds.includes(attestation.sourceId)) throw new Error(`${passage.passageId}: claim ${claimId} does not cite ${attestation.sourceId}.`)
    }
    if (!passage.locator.trim() || !passage.excerpt.trim()) throw new Error(`${passage.passageId}: inspected evidence requires a locator and bounded text.`)
    return {
      passageId: passage.passageId,
      sourceId: attestation.sourceId,
      locator: passage.locator,
      locatorKind: passage.locatorKind,
      excerpt: passage.excerpt,
      isParaphrase: passage.isParaphrase,
      extractionMethod: attestation.extractionMethod,
      originalDocumentInspected: true,
      sourceRevision: passage.sourceRevision,
    }
  }))
  if (new Set(passages.map((passage) => passage.passageId)).size !== passages.length) throw new Error('Duplicate passage id.')

  const passageIdsByClaim = new Map<string, string[]>()
  for (const attestation of input.attestations) for (const passage of attestation.passages) {
    for (const claimId of passage.claimIds) passageIdsByClaim.set(claimId, [...(passageIdsByClaim.get(claimId) ?? []), passage.passageId])
  }

  const claims = [...cited.claimIds].sort().map((claimId) => {
    const claim = claimsById.get(claimId)!
    const passageIds = passageIdsByClaim.get(claimId) ?? []
    if (!passageIds.length) throw new Error(`Inspected passage missing for cited claim: ${claimId}`)
    return {
      claimId,
      submittedStatement: claim.statement,
      auditedStatement: claim.statement,
      claimType: claimType(claim),
      sourceIds: [...claim.sourceIds].filter((id) => cited.sourceIds.has(id)).sort(),
      passageIds: [...passageIds].sort(),
      epistemicStatus: 'passage-supports-bounded-claim' as const,
      verificationScope: `${claim.scope} Boundary: ${claim.boundary}`,
      uncertainty: claim.uncertainty.statement,
      disagreements: [],
      unsupportedExtensions: [claim.boundary],
      reviewerDecisions: [{
        decision: 'Retained for an internal rehearsal after source-to-claim and locator checks.',
        rationale: 'This is internal editorial verification, not independent expert review or reproduction.',
        decidedBy: 'internal-editorial' as const,
        decidedAt: input.generatedAt,
      }],
    }
  })

  const usedSources = [...cited.sourceIds].sort().map((sourceId) => {
    const source = sourcesById.get(sourceId)!
    const attestation = attestations.get(sourceId)!
    return {
      sourceId,
      submittedCitation: `${source.authors.join(', ')}. ${source.title}. ${source.publisher}. ${source.publishedAt}.`,
      correctedCitation: null,
      identifier: source.identifiers[0] ? `${source.identifiers[0].scheme}:${source.identifiers[0].value}` : source.url,
      publisherUrl: source.url,
      publicationType: 'source-bound-record',
      rightsBasis: rightsBasis(source),
      verificationState: 'document-inspected' as const,
      verifiedAt: attestation.verifiedAt,
      metadataProvenance: attestation.metadataProvenance,
    }
  })

  const draft: EvidenceDossierDraft = {
    dossierId: input.dossierId,
    title: `Internal rehearsal: ${record.title}`,
    inquiry: compiledPage.contract.searchIntent.readerQuestion,
    domainId: record.domainSlug,
    intendedUse: input.intendedUse,
    prohibitedUses: [...input.prohibitedUses],
    methodology: `${input.methodology} Substantial-page contract ${compiledPage.contractDigest}; adapter ${SUBSTANTIAL_PAGE_DOSSIER_ADAPTER_VERSION}.`,
    generatedAt: input.generatedAt,
    corpusRevision: input.corpusRevision,
    reviewState: input.reviewState,
    sources: usedSources,
    passages,
    claims,
    comparisons: [],
    priorRevisions: [],
    contradictions: [],
    unsupportedInferences: [...new Set(record.prohibitedInferences)],
    limitations: [...input.limitations],
    disclaimer: input.disclaimer,
  }
  return compileEvidenceDossier(draft)
}
