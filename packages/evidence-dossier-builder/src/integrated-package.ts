import { createHash } from 'node:crypto'

import { provenanceDigest } from './canonicalize.ts'
import { INTERNAL_REHEARSAL_ENGAGEMENT, compilePackage, type CompileOptions } from './compile.ts'
import { renderDossierJsonLdText } from './jsonld.ts'
import { renderEvidenceDossierPdf } from './pdf.ts'
import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'
import { canonicalJson as calculationCanonicalJson, verifyCalculationReceipt, type CalculationReceipt } from '../../wasm-kernel/src/receipt.ts'

export const INTEGRATED_PACKAGE_VERSION = 'maha-evidence-package/0.2' as const
const CALCULATION_ATTACHMENT_SCHEMA = 'maha-dossier-calculation-attachment/1.0' as const
export interface IntegratedFile { path: string; mediaType: string; bytes: Uint8Array; sha256: string }
export interface IntegratedFileDescriptor { path: string; mediaType: string; bytes: number; sha256: string }
export interface IntegratedDossierPackage {
  manifest: Record<string, unknown> & { packageDigest: string; files: readonly IntegratedFileDescriptor[] }
  files: readonly IntegratedFile[]
}

const digest = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const encoded = (path: string, mediaType: string, value: string): IntegratedFile => {
  const bytes = new TextEncoder().encode(value); return { path, mediaType, bytes, sha256: digest(bytes) }
}

export async function compileIntegratedPackage(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[], options: CompileOptions = {}): Promise<IntegratedDossierPackage> {
  const base = compilePackage(dossier, options)
  const claimIds = new Set(dossier.claims.map((claim) => claim.claimId))
  const ordered = [...attachments].sort((a, b) => a.receipt.receiptSha256 < b.receipt.receiptSha256 ? -1 : a.receipt.receiptSha256 > b.receipt.receiptSha256 ? 1 : 0)
  if (new Set(ordered.map((item) => item.receipt.receiptSha256)).size !== ordered.length) throw new Error('Calculation receipt digest must be unique within a dossier package.')
  for (const attachment of ordered) {
    if (attachment.schemaVersion !== CALCULATION_ATTACHMENT_SCHEMA || attachment.mediaType !== 'application/ld+json') throw new Error('Calculation attachment schema or media type is invalid.')
    if (attachment.dossierId !== dossier.dossierId) throw new Error('Calculation attachment dossier id does not match the dossier.')
    if (!attachment.claimIds.length || new Set(attachment.claimIds).size !== attachment.claimIds.length || attachment.claimIds.some((id) => !claimIds.has(id))) throw new Error('Calculation attachment references an unknown or duplicate dossier claim.')
    if (!await verifyCalculationReceipt(attachment.receipt)) throw new Error('Calculation receipt failed deterministic verification.')
  }
  const engagement = options.engagement ?? INTERNAL_REHEARSAL_ENGAGEMENT
  const pdf = await renderEvidenceDossierPdf({ dossier, attachments: ordered, packageVersion: INTEGRATED_PACKAGE_VERSION, engagementLabel: `${engagement.mode}; list $${engagement.listPriceUsd}; contracted $${engagement.contractedPriceUsd}; received $${engagement.cashReceivedUsd}` })
  const files: IntegratedFile[] = [
    ...base.files.map((entry) => encoded(entry.path, entry.mediaType, entry.content)),
    encoded('dossier.jsonld', 'application/ld+json', renderDossierJsonLdText(dossier, ordered)),
    encoded('calculation-receipts.json', 'application/json', `${calculationCanonicalJson(ordered)}\n`),
    { path: 'evidence-dossier.pdf', mediaType: 'application/pdf', bytes: pdf, sha256: digest(pdf) },
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const descriptors = files.map(({ bytes, ...rest }) => ({ ...rest, bytes: bytes.byteLength }))
  const manifestBase = { packageVersion: INTEGRATED_PACKAGE_VERSION, dossierId: dossier.dossierId, corpusRevision: dossier.corpusRevision, dossierDigest: dossier.provenanceBundle.dossierDigest, engagement, offerReadiness: base.manifest.offerReadiness, files: descriptors }
  return { files, manifest: { ...manifestBase, packageDigest: provenanceDigest(manifestBase) } }
}

export function verifyIntegratedPackage(bundle: IntegratedDossierPackage): string[] {
  const findings: string[] = []
  for (const file of bundle.files) {
    const descriptor = bundle.manifest.files.find((item) => item.path === file.path)
    if (!descriptor || descriptor.bytes !== file.bytes.byteLength || descriptor.sha256 !== digest(file.bytes) || file.sha256 !== digest(file.bytes)) findings.push(`integrated-file-invalid:${file.path}`)
  }
  const { packageDigest, ...base } = bundle.manifest
  if (packageDigest !== provenanceDigest(base)) findings.push('integrated-package-digest-invalid')
  const pdf = bundle.files.find((file) => file.path === 'evidence-dossier.pdf')
  if (!pdf || new TextDecoder().decode(pdf.bytes.slice(0, 5)) !== '%PDF-') findings.push('integrated-pdf-invalid')
  return findings
}

/**
 * Artifact-only verification. It reparses the exported dossier and receipt
 * ledger and recomputes each receipt digest without trusting compiler objects.
 */
export async function verifyIntegratedCalculationEvidence(bundle: IntegratedDossierPackage): Promise<string[]> {
  const findings = [...verifyIntegratedPackage(bundle)]
  const text = (path: string): string | null => {
    const file = bundle.files.find((entry) => entry.path === path)
    return file ? new TextDecoder().decode(file.bytes) : null
  }
  let dossier: { dossierId?: unknown; claims?: Array<{ claimId?: unknown; passageIds?: unknown }> }
  let attachments: Array<{ schemaVersion?: unknown; dossierId?: unknown; claimIds?: unknown; receipt?: CalculationReceipt }>
  try { dossier = JSON.parse(text('dossier.json') ?? '') as typeof dossier } catch { findings.push('integrated-dossier-unparseable'); return [...new Set(findings)] }
  try {
    const parsed = JSON.parse(text('calculation-receipts.json') ?? '') as unknown
    if (!Array.isArray(parsed)) throw new Error('not-array')
    attachments = parsed as typeof attachments
  } catch { findings.push('integrated-calculation-receipts-unparseable'); return [...new Set(findings)] }
  const claimIds = new Set((Array.isArray(dossier.claims) ? dossier.claims : []).map((claim) => typeof claim.claimId === 'string' ? claim.claimId : ''))
  const receiptIds = new Set<string>()
  for (const attachment of attachments) {
    if (attachment.schemaVersion !== CALCULATION_ATTACHMENT_SCHEMA || attachment.dossierId !== dossier.dossierId) findings.push('integrated-calculation-binding-invalid')
    if (!Array.isArray(attachment.claimIds) || !attachment.claimIds.length || new Set(attachment.claimIds).size !== attachment.claimIds.length || attachment.claimIds.some((id) => typeof id !== 'string' || !claimIds.has(id))) findings.push('integrated-calculation-claim-invalid')
    if (!attachment.receipt || !await verifyCalculationReceipt(attachment.receipt)) findings.push('integrated-calculation-receipt-invalid')
    else if (receiptIds.has(attachment.receipt.receiptSha256)) findings.push('integrated-calculation-receipt-duplicate')
    else receiptIds.add(attachment.receipt.receiptSha256)
  }
  const jsonLdText = text('dossier.jsonld')
  try {
    const jsonLd = JSON.parse(jsonLdText ?? '') as { calculations?: unknown[]; runtimeReceipts?: Array<{ receiptSha256?: string }> }
    if (!Array.isArray(jsonLd.calculations) || !Array.isArray(jsonLd.runtimeReceipts) || jsonLd.calculations.length !== attachments.length || jsonLd.runtimeReceipts.length !== attachments.length) findings.push('integrated-calculation-jsonld-count-invalid')
    else if (jsonLd.runtimeReceipts.some((receipt) => !receiptIds.has(String(receipt.receiptSha256)))) findings.push('integrated-calculation-jsonld-receipt-invalid')
  } catch { findings.push('integrated-calculation-jsonld-unparseable') }
  return [...new Set(findings)]
}
