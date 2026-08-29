import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path'

import { provenanceDigest } from './canonicalize.ts'
import { INTERNAL_REHEARSAL_ENGAGEMENT, compilePackage, type CompileOptions } from './compile.ts'
import { renderDossierJsonLdText } from './jsonld.ts'
import { renderEvidenceDossierPdf } from './pdf.ts'
import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'
import { canonicalJson as calculationCanonicalJson, verifyCalculationReceipt } from '../../wasm-kernel/src/receipt.ts'
import { createExecutedCalculationReceipt, verifyExecutedCalculationReceipt, verifyKernelArtifact, type KernelArtifact, type KernelManifest } from '../../wasm-kernel/dist/execution.js'
import { verifyComputationalWitnessReceipt, type DossierRuntimeWitnessAttachment } from '../../../lib/evidence-dossier/runtime-witness.ts'

export const INTEGRATED_PACKAGE_VERSION = 'maha-evidence-package/0.3' as const
const CALCULATION_ATTACHMENT_SCHEMA = 'maha-dossier-calculation-attachment/1.0' as const
export interface IntegratedFile { path: string; mediaType: string; bytes: Uint8Array; sha256: string }
export interface IntegratedFileDescriptor { path: string; mediaType: string; bytes: number; sha256: string }
export interface IntegratedDossierPackage {
  manifest: Record<string, unknown> & { packageDigest: string; files: readonly IntegratedFileDescriptor[] }
  files: readonly IntegratedFile[]
}
export interface IntegratedCompileOptions extends CompileOptions {
  kernelArtifact?: KernelArtifact
  runtimeWitnesses?: readonly DossierRuntimeWitnessAttachment[]
}

const digest = (bytes: Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const textBytes = (value: string): Uint8Array => new TextEncoder().encode(value)
const binary = (path: string, mediaType: string, bytes: Uint8Array): IntegratedFile => ({ path, mediaType, bytes, sha256: digest(bytes) })
const encoded = (path: string, mediaType: string, value: string): IntegratedFile => binary(path, mediaType, textBytes(value))
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

function validateWitnessBindings(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[], witnesses: readonly DossierRuntimeWitnessAttachment[]): void {
  const claimIds = new Set(dossier.claims.map((claim) => claim.claimId))
  const receiptIds = new Set(attachments.map((attachment) => attachment.receipt.receiptSha256))
  const witnessIds = new Set<string>()
  for (const attachment of witnesses) {
    const findings = verifyComputationalWitnessReceipt(attachment.receipt)
    if (findings.length) throw new Error(`Runtime witness failed verification: ${findings.join(',')}`)
    if (attachment.dossierId !== dossier.dossierId || attachment.receipt.bindings.dossierId !== dossier.dossierId) throw new Error('Runtime witness dossier binding is invalid.')
    if (!attachment.claimIds.length || attachment.claimIds.some((id) => !claimIds.has(id)) || calculationCanonicalJson(attachment.claimIds) !== calculationCanonicalJson(attachment.receipt.bindings.claimIds)) throw new Error('Runtime witness claim binding is invalid.')
    if (attachment.calculationReceiptIds.some((id) => !receiptIds.has(id)) || calculationCanonicalJson(attachment.calculationReceiptIds) !== calculationCanonicalJson(attachment.receipt.bindings.calculationReceiptIds)) throw new Error('Runtime witness calculation binding is invalid.')
    if (witnessIds.has(attachment.receipt.receiptSha256)) throw new Error('Runtime witness receipt digest must be unique within a dossier package.')
    witnessIds.add(attachment.receipt.receiptSha256)
  }
}

export async function compileIntegratedPackage(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[], options: IntegratedCompileOptions = {}): Promise<IntegratedDossierPackage> {
  const base = compilePackage(dossier, options)
  const claimIds = new Set(dossier.claims.map((claim) => claim.claimId))
  const ordered = [...attachments].sort((a, b) => a.receipt.receiptSha256 < b.receipt.receiptSha256 ? -1 : a.receipt.receiptSha256 > b.receipt.receiptSha256 ? 1 : 0)
  const witnesses = [...(options.runtimeWitnesses ?? [])].sort((a, b) => a.receipt.receiptSha256 < b.receipt.receiptSha256 ? -1 : a.receipt.receiptSha256 > b.receipt.receiptSha256 ? 1 : 0)
  if (new Set(ordered.map((item) => item.receipt.receiptSha256)).size !== ordered.length) throw new Error('Calculation receipt digest must be unique within a dossier package.')
  if (ordered.length && !options.kernelArtifact) throw new Error('Execution-bound calculations require an embedded kernel artifact.')
  if (options.kernelArtifact) {
    const findings = await verifyKernelArtifact(options.kernelArtifact)
    if (findings.length) throw new Error(`Embedded kernel artifact failed verification: ${findings.join(',')}`)
  }
  for (const attachment of ordered) {
    if (attachment.schemaVersion !== CALCULATION_ATTACHMENT_SCHEMA || attachment.mediaType !== 'application/ld+json') throw new Error('Calculation attachment schema or media type is invalid.')
    if (attachment.dossierId !== dossier.dossierId) throw new Error('Calculation attachment dossier id does not match the dossier.')
    if (!attachment.claimIds.length || new Set(attachment.claimIds).size !== attachment.claimIds.length || attachment.claimIds.some((id) => !claimIds.has(id))) throw new Error('Calculation attachment references an unknown or duplicate dossier claim.')
    if (!attachment.executionRequest) throw new Error('Calculation attachment is integrity-only; an execution request is required for reproducible packaging.')
    if (!await verifyCalculationReceipt(attachment.receipt)) throw new Error('Calculation receipt failed deterministic integrity verification.')
    const findings = await verifyExecutedCalculationReceipt(attachment.receipt, options.kernelArtifact!)
    if (findings.length) throw new Error(`Calculation receipt failed WASM re-execution: ${findings.join(',')}`)
    const requested = await createExecutedCalculationReceipt(attachment.executionRequest, options.kernelArtifact!)
    if (requested.receiptSha256 !== attachment.receipt.receiptSha256) throw new Error('Calculation execution request does not reproduce its attached receipt.')
  }
  validateWitnessBindings(dossier, ordered, witnesses)
  const engagement = options.engagement ?? INTERNAL_REHEARSAL_ENGAGEMENT
  const engagementLabel = `${engagement.mode}; list $${engagement.listPriceUsd}; contracted $${engagement.contractedPriceUsd}; received $${engagement.cashReceivedUsd}`
  const pdf = await renderEvidenceDossierPdf({ dossier, attachments: ordered, witnesses, packageVersion: INTEGRATED_PACKAGE_VERSION, engagementLabel })
  const files: IntegratedFile[] = [
    ...base.files.map((entry) => encoded(entry.path, entry.mediaType, entry.content)),
    encoded('dossier.jsonld', 'application/ld+json', renderDossierJsonLdText(dossier, ordered, witnesses)),
    encoded('calculation-receipts.json', 'application/json', `${calculationCanonicalJson(ordered)}\n`),
    encoded('runtime-witnesses.json', 'application/json', `${calculationCanonicalJson(witnesses)}\n`),
    { path: 'evidence-dossier.pdf', mediaType: 'application/pdf', bytes: pdf, sha256: digest(pdf) },
    ...(options.kernelArtifact ? [binary('kernel.wasm', 'application/wasm', options.kernelArtifact.bytes), encoded('kernel-manifest.json', 'application/json', `${calculationCanonicalJson(options.kernelArtifact.manifest)}\n`)] : []),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const descriptors = files.map(({ bytes, ...rest }) => ({ ...rest, bytes: bytes.byteLength }))
  const manifestBase = {
    packageVersion: INTEGRATED_PACKAGE_VERSION, dossierId: dossier.dossierId, corpusRevision: dossier.corpusRevision,
    dossierDigest: dossier.provenanceBundle.dossierDigest, engagement, offerReadiness: base.manifest.offerReadiness,
    calculationAssurance: ordered.length ? 'offline-wasm-reexecution-required' : 'no-calculation-claimed', runtimeWitnessCount: witnesses.length, files: descriptors,
  }
  return { files, manifest: { ...manifestBase, packageDigest: provenanceDigest(manifestBase) } }
}

export function verifyIntegratedPackage(bundle: IntegratedDossierPackage): string[] {
  const findings: string[] = []
  const paths = bundle.files.map((file) => file.path)
  if (new Set(paths).size !== paths.length || new Set(bundle.manifest.files.map((file) => file.path)).size !== bundle.manifest.files.length) findings.push('integrated-file-path-duplicate')
  if (bundle.files.length !== bundle.manifest.files.length) findings.push('integrated-file-count-invalid')
  for (const file of bundle.files) {
    const descriptor = bundle.manifest.files.find((item) => item.path === file.path)
    if (!descriptor || descriptor.bytes !== file.bytes.byteLength || descriptor.sha256 !== digest(file.bytes) || file.sha256 !== digest(file.bytes) || descriptor.mediaType !== file.mediaType) findings.push(`integrated-file-invalid:${file.path}`)
  }
  const { packageDigest, ...base } = bundle.manifest
  if (packageDigest !== provenanceDigest(base)) findings.push('integrated-package-digest-invalid')
  const pdf = bundle.files.find((file) => file.path === 'evidence-dossier.pdf')
  if (!pdf || decode(pdf.bytes.slice(0, 5)) !== '%PDF-') findings.push('integrated-pdf-invalid')
  return findings
}

/** Reruns every operation against the embedded WASM and rerenders PDF/JSON-LD. */
export async function verifyIntegratedCalculationEvidence(bundle: IntegratedDossierPackage): Promise<string[]> {
  const findings = [...verifyIntegratedPackage(bundle)]
  const file = (path: string): IntegratedFile | undefined => bundle.files.find((entry) => entry.path === path)
  const text = (path: string): string | null => { const entry = file(path); return entry ? decode(entry.bytes) : null }
  let dossier: EvidenceDossier; let attachments: DossierCalculationAttachment[]; let witnesses: DossierRuntimeWitnessAttachment[]
  try { dossier = JSON.parse(text('dossier.json') ?? '') as EvidenceDossier } catch { findings.push('integrated-dossier-unparseable'); return [...new Set(findings)] }
  try { const parsed = JSON.parse(text('calculation-receipts.json') ?? '') as unknown; if (!Array.isArray(parsed)) throw new Error(); attachments = parsed as DossierCalculationAttachment[] } catch { findings.push('integrated-calculation-receipts-unparseable'); return [...new Set(findings)] }
  try { const parsed = JSON.parse(text('runtime-witnesses.json') ?? '') as unknown; if (!Array.isArray(parsed)) throw new Error(); witnesses = parsed as DossierRuntimeWitnessAttachment[] } catch { findings.push('integrated-runtime-witnesses-unparseable'); return [...new Set(findings)] }
  let artifact: KernelArtifact | null = null
  if (attachments.length) {
    const wasm = file('kernel.wasm'); const manifestText = text('kernel-manifest.json')
    if (!wasm || !manifestText) findings.push('integrated-kernel-artifact-missing')
    else try { artifact = { bytes: wasm.bytes, manifest: JSON.parse(manifestText) as KernelManifest } } catch { findings.push('integrated-kernel-manifest-unparseable') }
  }
  const claimIds = new Set(dossier.claims.map((claim) => claim.claimId)); const receiptIds = new Set<string>()
  for (const attachment of attachments) {
    if (attachment.schemaVersion !== CALCULATION_ATTACHMENT_SCHEMA || attachment.dossierId !== dossier.dossierId) findings.push('integrated-calculation-binding-invalid')
    if (!attachment.executionRequest) findings.push('integrated-calculation-execution-request-missing')
    if (!attachment.claimIds.length || new Set(attachment.claimIds).size !== attachment.claimIds.length || attachment.claimIds.some((id) => !claimIds.has(id))) findings.push('integrated-calculation-claim-invalid')
    if (!await verifyCalculationReceipt(attachment.receipt)) findings.push('integrated-calculation-receipt-invalid')
    else if (receiptIds.has(attachment.receipt.receiptSha256)) findings.push('integrated-calculation-receipt-duplicate')
    else receiptIds.add(attachment.receipt.receiptSha256)
    if (artifact && (await verifyExecutedCalculationReceipt(attachment.receipt, artifact)).length) findings.push('integrated-calculation-reexecution-invalid')
    if (artifact && attachment.executionRequest) {
      try { if ((await createExecutedCalculationReceipt(attachment.executionRequest, artifact)).receiptSha256 !== attachment.receipt.receiptSha256) findings.push('integrated-calculation-request-binding-invalid') }
      catch { findings.push('integrated-calculation-request-binding-invalid') }
    }
  }
  for (const witness of witnesses) {
    if (verifyComputationalWitnessReceipt(witness.receipt).length) findings.push('integrated-runtime-witness-invalid')
    if (witness.dossierId !== dossier.dossierId || witness.calculationReceiptIds.some((id) => !receiptIds.has(id))) findings.push('integrated-runtime-witness-binding-invalid')
  }
  const engagement = bundle.manifest.engagement as typeof INTERNAL_REHEARSAL_ENGAGEMENT
  if (text('dossier.jsonld') !== renderDossierJsonLdText(dossier, attachments, witnesses)) findings.push('integrated-jsonld-rerender-mismatch')
  const expectedPdf = await renderEvidenceDossierPdf({ dossier, attachments, witnesses, packageVersion: INTEGRATED_PACKAGE_VERSION, engagementLabel: `${engagement.mode}; list $${engagement.listPriceUsd}; contracted $${engagement.contractedPriceUsd}; received $${engagement.cashReceivedUsd}` })
  const pdf = file('evidence-dossier.pdf')
  if (!pdf || digest(pdf.bytes) !== digest(expectedPdf)) findings.push('integrated-pdf-rerender-mismatch')
  try { validateWitnessBindings(dossier, attachments, witnesses) } catch { findings.push('integrated-runtime-witness-binding-invalid') }
  return [...new Set(findings)]
}

export function writeIntegratedPackage(bundle: IntegratedDossierPackage, outputDirectory: string): void {
  const findings = verifyIntegratedPackage(bundle)
  if (findings.length) throw new Error(`Integrated package failed validation: ${findings.join(',')}`)
  if (!isAbsolute(outputDirectory)) throw new Error('Integrated package output must be absolute.')
  const target = resolve(outputDirectory)
  if (target === parse(target).root || target === resolve(process.cwd()) || existsSync(target)) throw new Error('Refusing a broad or existing integrated package output directory.')
  const parent = dirname(target)
  if (!existsSync(parent)) throw new Error('Integrated package output parent does not exist.')
  const staging = mkdtempSync(join(parent, `.${basename(target)}.staging-`))
  try {
    for (const entry of bundle.files) writeFileSync(join(staging, entry.path), entry.bytes, { mode: 0o600, flag: 'wx' })
    writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    renameSync(staging, target)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
}

export async function verifyIntegratedPackageDirectory(manifestPath: string): Promise<{ ok: boolean; filesChecked: number; findings: string[] }> {
  const absolute = resolve(manifestPath)
  if (!existsSync(absolute)) return { ok: false, filesChecked: 0, findings: ['integrated-manifest-missing'] }
  try {
    const manifest = JSON.parse(readFileSync(absolute, 'utf8')) as IntegratedDossierPackage['manifest']
    if (!Array.isArray(manifest.files)) return { ok: false, filesChecked: 0, findings: ['integrated-manifest-files-invalid'] }
    const directory = dirname(absolute); const files: IntegratedFile[] = []
    for (const descriptor of manifest.files) {
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(descriptor.path)) return { ok: false, filesChecked: files.length, findings: ['integrated-file-path-invalid'] }
      const path = join(directory, descriptor.path)
      if (!existsSync(path)) return { ok: false, filesChecked: files.length, findings: [`integrated-file-missing:${descriptor.path}`] }
      files.push(binary(descriptor.path, descriptor.mediaType, readFileSync(path)))
    }
    const findings = await verifyIntegratedCalculationEvidence({ manifest, files })
    return { ok: findings.length === 0, filesChecked: files.length, findings }
  } catch {
    return { ok: false, filesChecked: 0, findings: ['integrated-manifest-unparseable'] }
  }
}
