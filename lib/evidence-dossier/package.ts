import { existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path'

import { canonicalJson, provenanceDigest, sha256Hex } from './digest.ts'
import { serializeDossier, serializeDossierCanonical } from './serialize.ts'
import type { EvidenceDossier } from './schema.ts'
import { assertValidDossier } from './validator.ts'

export const DOSSIER_PACKAGE_VERSION = 'maha-evidence-package/0.1' as const
export const DOSSIER_OFFER_LIST_PRICE_USD = 5_000 as const

export interface DossierEngagement {
  mode: 'internal-rehearsal' | 'paid-pilot'
  listPriceUsd: typeof DOSSIER_OFFER_LIST_PRICE_USD
  contractedPriceUsd: number
  cashReceivedUsd: number
  requestedAt: string
  deliveryTargetDays: number
  customerReference: string | null
}

export interface OfferReadinessDecision {
  readyForFixedFeeOffer: boolean
  evaluatedAgainst: 'maha-evidence-offer/0.1'
  reasons: string[]
  measures: {
    claims: number
    sources: number
    inspectedSources: number
    passages: number
    comparisons: number
    limitations: number
  }
}

export interface DossierPackageFile {
  path: string
  mediaType: string
  bytes: number
  sha256: string
  content: string
}

export interface DossierPackage {
  manifest: {
    packageVersion: typeof DOSSIER_PACKAGE_VERSION
    dossierId: string
    corpusRevision: string
    dossierDigest: string
    packageDigest: string
    engagement: DossierEngagement
    offerReadiness: OfferReadinessDecision
    files: Array<Omit<DossierPackageFile, 'content'>>
  }
  files: DossierPackageFile[]
}

function money(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) throw new Error(`${field} must be a bounded non-negative integer.`)
}

function assertEngagement(engagement: DossierEngagement): void {
  if (engagement.listPriceUsd !== DOSSIER_OFFER_LIST_PRICE_USD) throw new Error('listPriceUsd must preserve the declared $5,000 offer price.')
  money(engagement.contractedPriceUsd, 'contractedPriceUsd')
  money(engagement.cashReceivedUsd, 'cashReceivedUsd')
  if (!Number.isInteger(engagement.deliveryTargetDays) || engagement.deliveryTargetDays < 1 || engagement.deliveryTargetDays > 90) throw new Error('deliveryTargetDays must be between 1 and 90.')
  if (Number.isNaN(Date.parse(engagement.requestedAt))) throw new Error('requestedAt must be an ISO instant.')
  if (engagement.mode === 'internal-rehearsal') {
    if (engagement.contractedPriceUsd !== 0 || engagement.cashReceivedUsd !== 0 || engagement.customerReference !== null) {
      throw new Error('An internal rehearsal cannot record contracted revenue, cash received, or a customer reference.')
    }
  } else {
    if (engagement.contractedPriceUsd < 1) throw new Error('A paid pilot must record a non-zero contracted price.')
    if (!engagement.customerReference?.trim()) throw new Error('A paid pilot must carry a bounded customer reference.')
    if (engagement.cashReceivedUsd > engagement.contractedPriceUsd) throw new Error('cashReceivedUsd cannot exceed contractedPriceUsd.')
  }
}

export function evaluateDossierOfferReadiness(dossier: EvidenceDossier): OfferReadinessDecision {
  assertValidDossier(dossier)
  const reasons: string[] = []
  const inspectedSources = dossier.sources.filter((source) => source.verificationState === 'document-inspected').length
  if (dossier.claims.length < 8 || dossier.claims.length > 15) reasons.push('offer-claim-scope-outside-8-to-15')
  if (dossier.sources.length < 5 || dossier.sources.length > 12) reasons.push('offer-source-scope-outside-5-to-12')
  if (inspectedSources !== dossier.sources.length) reasons.push('offer-source-not-inspected')
  if (!dossier.comparisons.length) reasons.push('offer-comparison-missing')
  if (dossier.limitations.length < 3) reasons.push('offer-limitations-insufficient')
  if (dossier.prohibitedUses.length < 3) reasons.push('offer-prohibited-uses-insufficient')
  if (dossier.reviewState === 'illustrative-draft') reasons.push('offer-internal-audit-missing')
  return {
    readyForFixedFeeOffer: reasons.length === 0,
    evaluatedAgainst: 'maha-evidence-offer/0.1',
    reasons,
    measures: {
      claims: dossier.claims.length,
      sources: dossier.sources.length,
      inspectedSources,
      passages: dossier.passages.length,
      comparisons: dossier.comparisons.length,
      limitations: dossier.limitations.length,
    },
  }
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  // Spreadsheet applications may execute cells beginning with formula sigils.
  // Prefixing those values preserves the text while preventing CSV injection.
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`
}

function csv(rows: unknown[][]): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function markdown(dossier: EvidenceDossier, readiness: OfferReadinessDecision, engagement: DossierEngagement): string {
  const claims = dossier.claims.map((claim) => [
    `## ${claim.claimId}`,
    `**Submitted:** ${claim.submittedStatement}`,
    `**Audited:** ${claim.auditedStatement}`,
    `**Status:** ${claim.epistemicStatus}`,
    `**Scope:** ${claim.verificationScope}`,
    `**Uncertainty:** ${claim.uncertainty}`,
    `**Sources:** ${claim.sourceIds.join(', ')}`,
    `**Passages:** ${claim.passageIds.join(', ')}`,
    `**Unsupported extensions:** ${claim.unsupportedExtensions.join(' | ')}`,
  ].join('\n\n')).join('\n\n')
  return [
    `# ${dossier.title}`,
    `Package: ${DOSSIER_PACKAGE_VERSION}`,
    `Engagement: ${engagement.mode}; list price $${engagement.listPriceUsd}; contracted $${engagement.contractedPriceUsd}; cash received $${engagement.cashReceivedUsd}`,
    `Offer ready: ${readiness.readyForFixedFeeOffer ? 'yes' : 'no'}${readiness.reasons.length ? ` (${readiness.reasons.join(', ')})` : ''}`,
    `Review state: ${dossier.reviewState}`,
    `Dossier digest: ${dossier.provenanceBundle.dossierDigest}`,
    `## Inquiry\n\n${dossier.inquiry}`,
    `## Intended use\n\n${dossier.intendedUse}`,
    `## Executive boundary\n\n${dossier.disclaimer}`,
    '## Claims', claims,
    `## Contradictions\n\n${dossier.contradictions.map((item) => `- ${item}`).join('\n')}`,
    `## Unsupported inferences\n\n${dossier.unsupportedInferences.map((item) => `- ${item}`).join('\n')}`,
    `## Limitations\n\n${dossier.limitations.map((item) => `- ${item}`).join('\n')}`,
  ].join('\n\n') + '\n'
}

function html(dossier: EvidenceDossier, readiness: OfferReadinessDecision): string {
  const claims = dossier.claims.map((claim) => `<article><h2>${escapeHtml(claim.claimId)}</h2><p><strong>Audited statement:</strong> ${escapeHtml(claim.auditedStatement)}</p><p><strong>Status:</strong> ${escapeHtml(claim.epistemicStatus)}</p><p><strong>Scope:</strong> ${escapeHtml(claim.verificationScope)}</p><p><strong>Uncertainty:</strong> ${escapeHtml(claim.uncertainty)}</p></article>`).join('')
  const sources = dossier.sources.map((source) => `<tr><td>${escapeHtml(source.sourceId)}</td><td>${escapeHtml(source.correctedCitation ?? source.submittedCitation)}</td><td>${escapeHtml(source.verificationState)}</td><td>${escapeHtml(source.rightsBasis)}</td></tr>`).join('')
  const passages = dossier.passages.map((passage) => `<article><h3>${escapeHtml(passage.passageId)}</h3><p><strong>Locator:</strong> ${escapeHtml(passage.locator ?? 'withheld')}</p><p>${escapeHtml(passage.excerpt)}</p><code>${escapeHtml(passage.passageHash)}</code></article>`).join('')
  const comparisons = dossier.comparisons.map((comparison) => `<article><h3>${escapeHtml(comparison.comparisonId)}</h3><p><strong>Relation:</strong> ${escapeHtml(comparison.relation)}</p><p>${escapeHtml(comparison.relationRationale)}</p><p><strong>Replication assessment:</strong> ${escapeHtml(comparison.replicationAssessment)}</p></article>`).join('')
  const list = (heading: string, items: readonly string[]) => `<section><h2>${heading}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(dossier.title)}</title><style>body{font:16px/1.55 system-ui;max-width:900px;margin:48px auto;padding:0 24px;color:#1a2420;background:#eef1ec}header,article,section{border:1px solid #c8cec6;background:#fbfcfa;padding:24px;margin:18px 0}table{width:100%;border-collapse:collapse;background:#fbfcfa}th,td{border:1px solid #c8cec6;padding:10px;text-align:left;vertical-align:top}code{overflow-wrap:anywhere}.blocked{color:#a33624}@media print{body{margin:0;background:#fff}article,section{break-inside:avoid}}</style></head><body><header><p>INTERNAL EVIDENCE DOSSIER</p><h1>${escapeHtml(dossier.title)}</h1><p>${escapeHtml(dossier.inquiry)}</p><p class="${readiness.readyForFixedFeeOffer ? '' : 'blocked'}">Fixed-fee offer readiness: ${readiness.readyForFixedFeeOffer ? 'ready' : `blocked - ${escapeHtml(readiness.reasons.join(', '))}`}</p><code>${escapeHtml(dossier.provenanceBundle.dossierDigest)}</code></header><section><h2>Sources</h2><table><thead><tr><th>ID</th><th>Citation</th><th>Verification</th><th>Rights</th></tr></thead><tbody>${sources}</tbody></table></section><section><h2>Passages</h2>${passages}</section><section><h2>Claims</h2>${claims}</section><section><h2>Comparisons</h2>${comparisons || '<p>No comparison was compiled.</p>'}</section>${list('Contradictions', dossier.contradictions)}${list('Unsupported inferences', dossier.unsupportedInferences)}${list('Limitations', dossier.limitations)}<section><h2>Boundary</h2><p>${escapeHtml(dossier.disclaimer)}</p></section></body></html>`
}

function file(path: string, mediaType: string, content: string): DossierPackageFile {
  return { path, mediaType, content, bytes: Buffer.byteLength(content, 'utf8'), sha256: `sha256:${sha256Hex(content)}` }
}

export function buildEvidenceDossierPackage(dossier: EvidenceDossier, engagement: DossierEngagement): DossierPackage {
  assertValidDossier(dossier)
  assertEngagement(engagement)
  const offerReadiness = evaluateDossierOfferReadiness(dossier)
  const files = [
    file('dossier.json', 'application/json', `${serializeDossier(dossier)}\n`),
    file('dossier.canonical.json', 'application/json', `${serializeDossierCanonical(dossier)}\n`),
    file('reviewer-packet.md', 'text/markdown', markdown(dossier, offerReadiness, engagement)),
    file('print-report.html', 'text/html', html(dossier, offerReadiness)),
    file('claim-ledger.csv', 'text/csv', csv([
      ['claim_id', 'submitted_statement', 'audited_statement', 'claim_type', 'epistemic_status', 'source_ids', 'passage_ids', 'scope', 'uncertainty', 'unsupported_extensions', 'provenance_digest'],
      ...dossier.claims.map((claim) => [claim.claimId, claim.submittedStatement, claim.auditedStatement, claim.claimType, claim.epistemicStatus, claim.sourceIds, claim.passageIds, claim.verificationScope, claim.uncertainty, claim.unsupportedExtensions, claim.provenanceDigest]),
    ])),
    file('source-ledger.csv', 'text/csv', csv([
      ['source_id', 'submitted_citation', 'corrected_citation', 'identifier', 'publisher_url', 'publication_type', 'rights_basis', 'verification_state', 'verified_at', 'metadata_provenance'],
      ...dossier.sources.map((source) => [source.sourceId, source.submittedCitation, source.correctedCitation, source.identifier, source.publisherUrl, source.publicationType, source.rightsBasis, source.verificationState, source.verifiedAt, source.metadataProvenance]),
    ])),
    file('passage-ledger.csv', 'text/csv', csv([
      ['passage_id', 'source_id', 'locator', 'locator_kind', 'excerpt', 'is_paraphrase', 'extraction_method', 'original_document_inspected', 'passage_hash', 'source_revision'],
      ...dossier.passages.map((passage) => [passage.passageId, passage.sourceId, passage.locator, passage.locatorKind, passage.excerpt, passage.isParaphrase, passage.extractionMethod, passage.originalDocumentInspected, passage.passageHash, passage.sourceRevision]),
    ])),
    file('comparison-matrix.csv', 'text/csv', csv([
      ['comparison_id', 'relation', 'question', 'source_ids', 'axis', 'comparable', 'values', 'note', 'replication_assessment', 'provenance_digest'],
      ...dossier.comparisons.flatMap((comparison) => comparison.axes.map((axis) => [comparison.comparisonId, comparison.relation, comparison.question, comparison.sourceIds, axis.axis, axis.comparable, canonicalJson(axis.values), axis.note, comparison.replicationAssessment, comparison.provenanceDigest])),
    ])),
  ].sort((left, right) => left.path.localeCompare(right.path))
  const descriptors = files.map(({ content: _, ...descriptor }) => descriptor)
  const manifestBase = {
    packageVersion: DOSSIER_PACKAGE_VERSION,
    dossierId: dossier.dossierId,
    corpusRevision: dossier.corpusRevision,
    dossierDigest: dossier.provenanceBundle.dossierDigest,
    engagement,
    offerReadiness,
    files: descriptors,
  }
  return {
    files,
    manifest: { ...manifestBase, packageDigest: provenanceDigest(manifestBase) },
  }
}

export function validateEvidenceDossierPackage(bundle: DossierPackage): string[] {
  const issues: string[] = []
  const paths = bundle.files.map((entry) => entry.path)
  if (new Set(paths).size !== paths.length) issues.push('package-file-path-duplicate')
  for (const entry of bundle.files) {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(entry.path)) issues.push(`package-file-path-invalid:${entry.path}`)
    if (entry.bytes !== Buffer.byteLength(entry.content, 'utf8')) issues.push(`package-file-size-mismatch:${entry.path}`)
    if (entry.sha256 !== `sha256:${sha256Hex(entry.content)}`) issues.push(`package-file-digest-mismatch:${entry.path}`)
    const descriptor = bundle.manifest.files.find((candidate) => candidate.path === entry.path)
    if (!descriptor || descriptor.sha256 !== entry.sha256 || descriptor.bytes !== entry.bytes || descriptor.mediaType !== entry.mediaType) issues.push(`package-manifest-file-mismatch:${entry.path}`)
  }
  if (bundle.manifest.files.length !== bundle.files.length) issues.push('package-manifest-file-count-mismatch')
  const { packageDigest, ...manifestBase } = bundle.manifest
  if (packageDigest !== provenanceDigest(manifestBase)) issues.push('package-digest-mismatch')
  return [...new Set(issues)]
}

export function writeEvidenceDossierPackage(bundle: DossierPackage, outputDirectory: string): void {
  const issues = validateEvidenceDossierPackage(bundle)
  if (issues.length) throw new Error(`Evidence Dossier package failed validation: ${issues.join(', ')}`)
  if (!isAbsolute(outputDirectory)) throw new Error('Output directory must be an absolute path.')
  const target = resolve(outputDirectory)
  if (target === parse(target).root || target === resolve(process.cwd())) throw new Error('Refusing a broad output directory.')
  if (existsSync(target)) throw new Error(`Output directory already exists: ${target}`)
  const parent = dirname(target)
  if (!existsSync(parent)) throw new Error(`Output parent does not exist: ${parent}`)
  const staging = mkdtempSync(join(parent, `.${basename(target)}.staging-`))
  try {
    for (const entry of bundle.files) writeFileSync(join(staging, entry.path), entry.content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    renameSync(staging, target)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
}
