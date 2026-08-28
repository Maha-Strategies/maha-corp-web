import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  attachRuntimeWitnessToDossier,
  verifyComputationalWitnessReceipt,
  type ComputationalWitnessReceipt,
} from '../packages/evidence-dossier-builder/src/runtime-witness.ts'

const fixtureUrl = new URL('../packages/maha-witness/fixtures/success-receipt.json', import.meta.url)

test('Python witness fixture verifies under the TypeScript dossier canonicalizer', async () => {
  const receipt = JSON.parse(await readFile(fixtureUrl, 'utf8')) as ComputationalWitnessReceipt
  assert.deepEqual(verifyComputationalWitnessReceipt(receipt), [])
  const attachment = attachRuntimeWitnessToDossier({
    dossierId: 'urn:maha:dossier:thermal-001',
    claimIds: ['claim-thermal-rise'],
    calculationReceiptIds: [`sha256:${'1'.repeat(64)}`],
    receipt,
  })
  assert.equal(attachment.schemaVersion, 'maha-dossier-runtime-witness-attachment/0.1')
  assert.equal(attachment.receipt.assurance.independentlyReproduced, false)
  assert.equal(attachment.receipt.assurance.scientificValidityCertified, false)
})

test('dossier attachment rejects tampering and forged bindings', async () => {
  const receipt = JSON.parse(await readFile(fixtureUrl, 'utf8')) as ComputationalWitnessReceipt
  const tampered = structuredClone(receipt)
  ;(tampered.environment as Record<string, unknown>).pythonVersion = '9.9.9'
  assert.deepEqual(verifyComputationalWitnessReceipt(tampered), ['witness-environment-digest-invalid', 'witness-receipt-digest-invalid'])
  assert.throws(() => attachRuntimeWitnessToDossier({ dossierId: 'urn:wrong', claimIds: ['claim-thermal-rise'], calculationReceiptIds: [`sha256:${'1'.repeat(64)}`], receipt }), /binding does not match/)
  const malformedFindings = verifyComputationalWitnessReceipt({ schemaVersion: 'maha-computational-witness/0.1' })
  assert.ok(malformedFindings.includes('witness-unparseable'))
})

test('witness implementation remains outside every public application surface', async () => {
  const files = [
    'app/sitemap.ts',
    'app/llms.txt/route.ts',
    'app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx',
  ]
  for (const file of files) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /maha-witness|runtime-witness|computational-witness/)
  }
})
