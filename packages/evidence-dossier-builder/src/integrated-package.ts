import { createHash } from 'node:crypto'

import { provenanceDigest } from './canonicalize.ts'
import { INTERNAL_REHEARSAL_ENGAGEMENT, compilePackage, type CompileOptions } from './compile.ts'
import { renderDossierJsonLdText } from './jsonld.ts'
import { renderEvidenceDossierPdf } from './pdf.ts'
import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'
import { verifyCalculationReceipt } from '../../wasm-kernel/src/receipt.ts'

export const INTEGRATED_PACKAGE_VERSION = 'maha-evidence-package/0.2' as const
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
    if (attachment.dossierId !== dossier.dossierId) throw new Error('Calculation attachment dossier id does not match the dossier.')
    if (!attachment.claimIds.length || attachment.claimIds.some((id) => !claimIds.has(id))) throw new Error('Calculation attachment references an unknown dossier claim.')
    if (!await verifyCalculationReceipt(attachment.receipt)) throw new Error('Calculation receipt failed deterministic verification.')
  }
  const engagement = options.engagement ?? INTERNAL_REHEARSAL_ENGAGEMENT
  const pdf = await renderEvidenceDossierPdf({ dossier, attachments: ordered, packageVersion: INTEGRATED_PACKAGE_VERSION, engagementLabel: `${engagement.mode}; list $${engagement.listPriceUsd}; contracted $${engagement.contractedPriceUsd}; received $${engagement.cashReceivedUsd}` })
  const files: IntegratedFile[] = [
    ...base.files.map((entry) => encoded(entry.path, entry.mediaType, entry.content)),
    encoded('dossier.jsonld', 'application/ld+json', renderDossierJsonLdText(dossier, ordered)),
    encoded('calculation-receipts.json', 'application/json', `${JSON.stringify(ordered, null, 2)}\n`),
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
