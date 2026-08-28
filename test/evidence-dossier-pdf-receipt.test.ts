import assert from 'node:assert/strict'
import test from 'node:test'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compilePackage, compileIntegratedPackage, renderDossierJsonLd, verifyIntegratedCalculationEvidence, verifyIntegratedPackage } from '../packages/evidence-dossier-builder/src/index.ts'
import { canonicalJson as calculationCanonicalJson, createCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'
import { createOptionalIntervalMultiplyReceiptInput } from '../packages/wasm-kernel/src/uncertainty.ts'

async function attachment() {
  const input = createOptionalIntervalMultiplyReceiptInput({
    leftName: 'lineLength', rightName: 'imageWidth', outputName: 'imageArea',
    left: { lower: '1000', upper: '1000', unit: 'nm' }, right: { lower: '500', upper: '500', unit: 'nm' }, outputUnit: 'nm2',
    kernel: { kernelVersion: '@maha/wasm-kernel/0.3.0', kernelSha256: `sha256:${'1'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/0.3', conformanceSha256: `sha256:${'2'.repeat(64)}`, compiler: { name: 'assemblyscript', version: '0.28.20', flags: ['--optimize'] } },
  })
  assert.ok(input)
  const receipt = await createCalculationReceipt(input)
  return {
    schemaVersion: 'maha-dossier-calculation-attachment/1.0' as const,
    dossierId: DEMONSTRATION_DOSSIER.dossierId,
    claimIds: ['clm_figure_conditions'],
    receipt,
    mediaType: 'application/ld+json' as const,
    jsonLd: { '@context': 'https://schema.org', '@type': 'MathSolver', identifier: receipt.receiptSha256 },
  }
}

test('integrated PDF and package are byte-identical and cryptographically valid', async () => {
  const item = await attachment()
  const first = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item])
  const second = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item])
  assert.deepEqual(first, second)
  assert.deepEqual(verifyIntegratedPackage(first), [])
  assert.deepEqual(await verifyIntegratedCalculationEvidence(first), [])
  const pdf = first.files.find((file) => file.path === 'evidence-dossier.pdf')!
  assert.equal(new TextDecoder().decode(pdf.bytes.slice(0, 5)), '%PDF-')
  assert.ok(pdf.bytes.byteLength > 5_000)
  const ledger = first.files.find((file) => file.path === 'calculation-receipts.json')!
  assert.equal(new TextDecoder().decode(ledger.bytes), `${calculationCanonicalJson([item])}\n`)
})

test('verified receipts populate distinct JSON-LD categories without changing passage support', async () => {
  const item = await attachment()
  const jsonld = renderDossierJsonLd(DEMONSTRATION_DOSSIER, [item])
  assert.equal(jsonld.calculations.length, 1)
  assert.equal(jsonld.runtimeReceipts.length, 1)
  assert.deepEqual(jsonld.claims.map((claim) => claim.supportedByPassages), DEMONSTRATION_DOSSIER.claims.map((claim) => claim.passageIds))
  assert.deepEqual(renderDossierJsonLd(DEMONSTRATION_DOSSIER).calculations, [])
})

test('tampered, cross-dossier, and unknown-claim attachments fail closed', async () => {
  const item = await attachment()
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [{ ...item, dossierId: 'wrong' }]), /dossier id/)
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [{ ...item, claimIds: ['unknown'] }]), /unknown or duplicate dossier claim/)
  const tampered = { ...item, receipt: { ...item.receipt, output: { resistanceNanoKelvinPerWatt: '1' } } }
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [tampered]), /deterministic verification/)
})

test('v0.1 package and commercial rehearsal position remain unchanged', () => {
  const first = compilePackage(DEMONSTRATION_DOSSIER)
  const second = compilePackage(DEMONSTRATION_DOSSIER)
  assert.deepEqual(first, second)
  assert.equal(first.manifest.packageVersion, 'maha-evidence-package/0.1')
  assert.equal(first.manifest.engagement.listPriceUsd, 5_000)
  assert.equal(first.manifest.engagement.contractedPriceUsd, 0)
  assert.equal(first.manifest.engagement.cashReceivedUsd, 0)
  assert.equal(first.manifest.offerReadiness.readyForFixedFeeOffer, false)
})

test('artifact verifier independently rejects a receipt changed after compilation', async () => {
  const item = await attachment()
  const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item])
  const receiptFile = bundle.files.find((file) => file.path === 'calculation-receipts.json')!
  const parsed = JSON.parse(new TextDecoder().decode(receiptFile.bytes))
  parsed[0].receipt.output.imageArea = '[1,1]'
  const bytes = new TextEncoder().encode(`${JSON.stringify(parsed, null, 2)}\n`)
  const changed = { ...bundle, files: bundle.files.map((file) => file.path === receiptFile.path ? { ...file, bytes } : file) }
  const findings = await verifyIntegratedCalculationEvidence(changed)
  assert.ok(findings.includes('integrated-file-invalid:calculation-receipts.json'))
  assert.ok(findings.includes('integrated-calculation-receipt-invalid'))
})
