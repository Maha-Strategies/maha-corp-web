import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEMONSTRATION_DOSSIER } from '../lib/evidence-dossier/demonstration.ts'
import { compilePackage, compileIntegratedPackage, renderDossierJsonLd, verifyIntegratedCalculationEvidence, verifyIntegratedPackage } from '../packages/evidence-dossier-builder/src/index.ts'
import { canonicalJson as calculationCanonicalJson } from '../packages/wasm-kernel/src/receipt.ts'
import { executeAndAttachCalculationToDossier } from '../packages/wasm-kernel/dist/dossier.js'
import type { KernelArtifact } from '../packages/wasm-kernel/dist/execution.js'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import type { DossierRuntimeWitnessAttachment, ComputationalWitnessReceipt } from '../lib/evidence-dossier/runtime-witness.ts'

const artifact: KernelArtifact = {
  bytes: readFileSync(resolve('packages/wasm-kernel/dist/kernel.wasm')),
  manifest: JSON.parse(readFileSync(resolve('packages/wasm-kernel/conformance/kernel-manifest.json'), 'utf8')),
}

const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`

function runtimeWitness(receiptId: string): DossierRuntimeWitnessAttachment {
  const artifacts = [
    { name: 'kernel.wasm', role: 'code' as const, mediaType: 'application/wasm', bytes: artifact.bytes.byteLength, sha256: artifact.manifest.kernelSha256 },
    { name: 'result.json', role: 'output' as const, mediaType: 'application/json', bytes: 20, sha256: `sha256:${'3'.repeat(64)}` },
  ]
  const environment = { runtime: 'node-wasm', isolation: 'private-test' }
  const bindings = { dossierId: DEMONSTRATION_DOSSIER.dossierId, claimIds: ['clm_figure_conditions'], calculationReceiptIds: [receiptId] }
  const snapshot = {
    schemaVersion: 'maha-computational-witness/0.1' as const, canonicalizationVersion: 'maha-dossier-canonical/1.0' as const,
    witnessVersion: 'maha-witness/0.3', jobId: 'job_integrated_fixture', callable: { module: '@maha/wasm-kernel', qualname: 'intervalAdd' },
    execution: { status: 'succeeded' as const, startedAt: '2026-08-25T00:00:00Z', finishedAt: '2026-08-25T00:00:01Z', failureType: null },
    artifacts, inputSha256: sha(artifacts.filter((item) => item.role === 'code')), outputSha256: sha(artifacts.filter((item) => item.role === 'output')),
    environment, environmentSha256: sha(environment), randomSeeds: {}, configuration: { deterministic: true }, adapters: [{ kind: 'wasm' }], bindings,
    assurance: { executionObserved: true as const, independentlyReproduced: false as const, scientificValidityCertified: false as const, environmentComplete: true, secretsCaptured: false as const },
  }
  const receipt = { ...snapshot, receiptSha256: sha(snapshot) } as ComputationalWitnessReceipt
  return { schemaVersion: 'maha-dossier-runtime-witness-attachment/0.1', dossierId: DEMONSTRATION_DOSSIER.dossierId, claimIds: bindings.claimIds, calculationReceiptIds: bindings.calculationReceiptIds, receipt }
}

async function attachment() {
  return executeAndAttachCalculationToDossier({
    dossierId: DEMONSTRATION_DOSSIER.dossierId,
    claimIds: ['clm_figure_conditions'],
    artifact,
    request: {
      schemaVersion: 'maha-wasm-execution-request/1.0', operation: 'interval-add',
      inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' },
      units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' },
    },
  })
}

test('integrated PDF and package are byte-identical and cryptographically valid', async () => {
  const item = await attachment()
  const first = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact })
  const second = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact })
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
  assert.equal(jsonld.runtimeReceipts.length, 0)
  assert.deepEqual(jsonld.claims.map((claim) => claim.supportedByPassages), DEMONSTRATION_DOSSIER.claims.map((claim) => claim.passageIds))
  assert.deepEqual(renderDossierJsonLd(DEMONSTRATION_DOSSIER).calculations, [])
})

test('tampered, cross-dossier, and unknown-claim attachments fail closed', async () => {
  const item = await attachment()
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [{ ...item, dossierId: 'wrong' }], { kernelArtifact: artifact }), /dossier id/)
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [{ ...item, claimIds: ['unknown'] }], { kernelArtifact: artifact }), /unknown or duplicate dossier claim/)
  const tampered = { ...item, receipt: { ...item.receipt, output: { resistanceNanoKelvinPerWatt: '1' } } }
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [tampered], { kernelArtifact: artifact }), /integrity verification/)
  const substitutedRequest = { ...item, executionRequest: { ...item.executionRequest, inputs: { ...item.executionRequest.inputs, leftLower: '999' } } }
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [substitutedRequest], { kernelArtifact: artifact }), /does not reproduce/)
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
  const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact })
  const receiptFile = bundle.files.find((file) => file.path === 'calculation-receipts.json')!
  const parsed = JSON.parse(new TextDecoder().decode(receiptFile.bytes))
  parsed[0].receipt.output.interval = '[1,1]'
  const bytes = new TextEncoder().encode(`${JSON.stringify(parsed, null, 2)}\n`)
  const changed = { ...bundle, files: bundle.files.map((file) => file.path === receiptFile.path ? { ...file, bytes } : file) }
  const findings = await verifyIntegratedCalculationEvidence(changed)
  assert.ok(findings.includes('integrated-file-invalid:calculation-receipts.json'))
  assert.ok(findings.includes('integrated-calculation-receipt-invalid'))
})

test('offline verifier reruns WASM and rejects a self-consistent forged output', async () => {
  const item = await attachment()
  const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact })
  const receiptFile = bundle.files.find((file) => file.path === 'calculation-receipts.json')!
  const parsed = JSON.parse(new TextDecoder().decode(receiptFile.bytes))
  parsed[0].receipt.output.interval = '[0,0]'
  // Integrity-only verification could be made to accept this by recomputing
  // receipt hashes. Execution verification instead reruns the embedded kernel.
  parsed[0].receipt.outputSha256 = item.receipt.outputSha256
  const bytes = new TextEncoder().encode(`${calculationCanonicalJson(parsed)}\n`)
  const changed = { ...bundle, files: bundle.files.map((file) => file.path === receiptFile.path ? { ...file, bytes, sha256: file.sha256 } : file) }
  assert.ok((await verifyIntegratedCalculationEvidence(changed)).includes('integrated-calculation-receipt-invalid'))
})

test('calculation absence remains explicit and does not embed a kernel', async () => {
  const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [])
  assert.equal(bundle.manifest.calculationAssurance, 'no-calculation-claimed')
  assert.equal(bundle.files.some((file) => file.path === 'kernel.wasm'), false)
  assert.deepEqual(await verifyIntegratedCalculationEvidence(bundle), [])
})

test('runtime witness remains a separate, digest-bound evidence category', async () => {
  const item = await attachment(); const witness = runtimeWitness(item.receipt.receiptSha256)
  const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact, runtimeWitnesses: [witness] })
  assert.deepEqual(await verifyIntegratedCalculationEvidence(bundle), [])
  const jsonLd = JSON.parse(new TextDecoder().decode(bundle.files.find((file) => file.path === 'dossier.jsonld')!.bytes))
  assert.equal(jsonLd.calculations.length, 1); assert.equal(jsonLd.runtimeReceipts.length, 1)
  await assert.rejects(() => compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact, runtimeWitnesses: [{ ...witness, calculationReceiptIds: [`sha256:${'9'.repeat(64)}`] }] }), /calculation binding/)
})

test('artifact verifier detects substituted kernel and presentation artifacts', async () => {
  const item = await attachment(); const bundle = await compileIntegratedPackage(DEMONSTRATION_DOSSIER, [item], { kernelArtifact: artifact })
  const mutate = (path: string, change: (bytes: Uint8Array) => Uint8Array) => ({ ...bundle, files: bundle.files.map((entry) => entry.path === path ? { ...entry, bytes: change(entry.bytes) } : entry) })
  const kernelFindings = await verifyIntegratedCalculationEvidence(mutate('kernel.wasm', (bytes) => { const copy = new Uint8Array(bytes); copy[copy.length - 1] ^= 1; return copy }))
  assert.ok(kernelFindings.includes('integrated-calculation-reexecution-invalid'))
  const jsonFindings = await verifyIntegratedCalculationEvidence(mutate('dossier.jsonld', () => new TextEncoder().encode('{}\n')))
  assert.ok(jsonFindings.includes('integrated-jsonld-rerender-mismatch'))
  const pdfFindings = await verifyIntegratedCalculationEvidence(mutate('evidence-dossier.pdf', (bytes) => { const copy = new Uint8Array(bytes); copy[100] ^= 1; return copy }))
  assert.ok(pdfFindings.includes('integrated-pdf-rerender-mismatch'))
})
