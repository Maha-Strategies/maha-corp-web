import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compileIntegratedPackage } from '../packages/evidence-dossier-builder/src/integrated-package.ts'
import { createCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'
import { createOptionalIntervalMultiplyReceiptInput } from '../packages/wasm-kernel/src/uncertainty.ts'

const output = resolve(process.argv[2] ?? 'output/pdf')
mkdirSync(output, { recursive: true })
const input = createOptionalIntervalMultiplyReceiptInput({
  leftName: 'lineLength', rightName: 'imageWidth', outputName: 'imageArea',
  left: { lower: '1000', upper: '1000', unit: 'nm' }, right: { lower: '500', upper: '500', unit: 'nm' }, outputUnit: 'nm2',
  kernel: { kernelVersion: '@maha/wasm-kernel/0.3.0', kernelSha256: `sha256:${'1'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/0.3', conformanceSha256: `sha256:${'2'.repeat(64)}`, compiler: { name: 'assemblyscript', version: '0.28.20', flags: ['--optimize'] } },
})
if (!input) throw new Error('The sample requires explicit calculation intervals.')
const receipt = await createCalculationReceipt(input)
const attachment = {
  schemaVersion: 'maha-dossier-calculation-attachment/1.0' as const, dossierId: DEMONSTRATION_DOSSIER.dossierId,
  claimIds: ['clm_figure_conditions'], receipt, mediaType: 'application/ld+json' as const,
  jsonLd: { '@context': 'https://schema.org', '@type': 'MathSolver', identifier: receipt.receiptSha256 },
}
const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [attachment])
const pdf = bundle.files.find((file) => file.path === 'evidence-dossier.pdf')
if (!pdf) throw new Error('Integrated package did not produce a PDF.')
writeFileSync(resolve(output, 'maha-evidence-dossier-calculation-receipt.pdf'), pdf.bytes)
writeFileSync(resolve(output, 'maha-evidence-dossier-manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`)
process.stdout.write(`${bundle.manifest.packageDigest}\n`)
