import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compileIntegratedPackage } from '../packages/evidence-dossier-builder/src/integrated-package.ts'
import { executeAndAttachCalculationToDossier } from '../packages/wasm-kernel/dist/dossier.js'
import type { KernelArtifact } from '../packages/wasm-kernel/dist/execution.js'

const output = resolve(process.argv[2] ?? 'output/pdf')
mkdirSync(output, { recursive: true })
const artifact: KernelArtifact = {
  bytes: readFileSync(resolve('packages/wasm-kernel/dist/kernel.wasm')),
  manifest: JSON.parse(readFileSync(resolve('packages/wasm-kernel/conformance/kernel-manifest.json'), 'utf8')),
}
const attachment = await executeAndAttachCalculationToDossier({
  dossierId: DEMONSTRATION_DOSSIER.dossierId, claimIds: ['clm_figure_conditions'], artifact,
  request: { schemaVersion: 'maha-wasm-execution-request/1.0', operation: 'interval-add', inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' }, units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' } },
})
const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [attachment], { kernelArtifact: artifact })
const pdf = bundle.files.find((file) => file.path === 'evidence-dossier.pdf')
if (!pdf) throw new Error('Integrated package did not produce a PDF.')
writeFileSync(resolve(output, 'maha-evidence-dossier-calculation-receipt.pdf'), pdf.bytes)
writeFileSync(resolve(output, 'maha-evidence-dossier-manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`)
process.stdout.write(`${bundle.manifest.packageDigest}\n`)
