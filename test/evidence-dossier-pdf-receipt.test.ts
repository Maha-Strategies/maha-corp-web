import assert from 'node:assert/strict'
import test from 'node:test'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compilePackage, compileIntegratedPackage, renderDossierJsonLd, verifyIntegratedPackage } from '../packages/evidence-dossier-builder/src/index.ts'
import { createCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'

async function attachment() {
  const receipt = await createCalculationReceipt({
    module: 'semiconductor-thermal', operation: 'layer-thermal-resistance',
    inputs: { thicknessNanometers: '100', areaSquareMicrometers: '10000', conductivityMilliwattsPerMeterKelvin: '25000' },
    units: { thicknessNanometers: 'nm', areaSquareMicrometers: 'um2', conductivityMilliwattsPerMeterKelvin: 'mW/(m*K)', resistanceNanoKelvinPerWatt: 'nK/W' },
    constants: {}, output: { resistanceNanoKelvinPerWatt: '400000' }, uncertainty: { model: 'exact integer arithmetic for declared inputs; physical parameter uncertainty not evaluated' },
    precisionPolicy: 'signed i64 fixed point; nearest ties to even', kernelVersion: '@maha/wasm-kernel/0.2.0',
    kernelSha256: `sha256:${'1'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/0.2',
    runtime: 'wasm-i64-fixed-point', compiler: { name: 'assemblyscript', version: '0.28.8', flags: ['--optimize'] },
    arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' }, conformanceSha256: `sha256:${'2'.repeat(64)}`,
  })
  return {
    schemaVersion: 'maha-dossier-calculation-attachment/1.0' as const,
    dossierId: DEMONSTRATION_DOSSIER.dossierId,
    claimIds: [DEMONSTRATION_DOSSIER.claims[0].claimId],
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
  const pdf = first.files.find((file) => file.path === 'evidence-dossier.pdf')!
  assert.equal(new TextDecoder().decode(pdf.bytes.slice(0, 5)), '%PDF-')
  assert.ok(pdf.bytes.byteLength > 5_000)
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
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [{ ...item, claimIds: ['unknown'] }]), /unknown dossier claim/)
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
