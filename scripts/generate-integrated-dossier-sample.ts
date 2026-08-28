import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compileIntegratedPackage } from '../packages/evidence-dossier-builder/src/integrated-package.ts'
import { createCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'

const output = resolve(process.argv[2] ?? 'output/pdf')
mkdirSync(output, { recursive: true })
const receipt = await createCalculationReceipt({
  module: 'semiconductor-thermal', operation: 'layer-thermal-resistance',
  inputs: { thicknessNanometers: '100', areaSquareMicrometers: '10000', conductivityMilliwattsPerMeterKelvin: '25000' },
  units: { thicknessNanometers: 'nm', areaSquareMicrometers: 'um2', conductivityMilliwattsPerMeterKelvin: 'mW/(m*K)', resistanceNanoKelvinPerWatt: 'nK/W' },
  constants: {}, output: { resistanceNanoKelvinPerWatt: '400000' }, uncertainty: { model: 'exact integer arithmetic for declared inputs; physical parameter uncertainty not evaluated' },
  precisionPolicy: 'signed i64 fixed point; nearest ties to even', kernelVersion: '@maha/wasm-kernel/0.2.0',
  kernelSha256: `sha256:${'1'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/0.2', runtime: 'wasm-i64-fixed-point',
  compiler: { name: 'assemblyscript', version: '0.28.8', flags: ['--optimize'] }, arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' },
  conformanceSha256: `sha256:${'2'.repeat(64)}`,
})
const attachment = {
  schemaVersion: 'maha-dossier-calculation-attachment/1.0' as const, dossierId: DEMONSTRATION_DOSSIER.dossierId,
  claimIds: [DEMONSTRATION_DOSSIER.claims[0].claimId], receipt, mediaType: 'application/ld+json' as const,
  jsonLd: { '@context': 'https://schema.org', '@type': 'MathSolver', identifier: receipt.receiptSha256 },
}
const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [attachment])
const pdf = bundle.files.find((file) => file.path === 'evidence-dossier.pdf')
if (!pdf) throw new Error('Integrated package did not produce a PDF.')
writeFileSync(resolve(output, 'maha-evidence-dossier-calculation-receipt.pdf'), pdf.bytes)
writeFileSync(resolve(output, 'maha-evidence-dossier-manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`)
process.stdout.write(`${bundle.manifest.packageDigest}\n`)
