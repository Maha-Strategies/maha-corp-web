import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { validateContextProofFixture, type ContextProofFixture } from '../lib/context-proof-fixture.ts'

const root = join(import.meta.dirname, '..')
const fixtureDirectory = join(root, 'test', 'fixtures', 'context-proof')
const index = JSON.parse(readFileSync(join(fixtureDirectory, 'index.json'), 'utf8')) as {
  bundles: Array<{
    id: string
    path: string
    adversarialPath?: string
    adversarialExpectedStatus?: string
    adversarialExpectedError?: string
    expectedStatus: string
  }>
}

const results = []
for (const bundle of index.bundles) {
  const fixture = JSON.parse(readFileSync(join(fixtureDirectory, bundle.path), 'utf8')) as ContextProofFixture
  validateContextProofFixture(fixture)
  if (fixture.proofDecision.status !== bundle.expectedStatus) throw new Error(`${bundle.id} status differs from index.`)

  let adversarialRejected: boolean | null = null
  if (bundle.adversarialPath) {
    const adversarial = JSON.parse(readFileSync(join(fixtureDirectory, bundle.adversarialPath), 'utf8')) as ContextProofFixture
    if (adversarial.proofDecision.status !== bundle.adversarialExpectedStatus) throw new Error(`${bundle.id} adversarial status differs from index.`)
    if (adversarial.proofDecision.shouldAttemptProof || adversarial.proofDecision.chargePermitted || adversarial.expectedPublicValues !== null) {
      throw new Error(`${bundle.id} adversarial fixture must be explicitly reject-before-proof and no-charge.`)
    }
    try {
      validateContextProofFixture(adversarial)
      adversarialRejected = false
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Retained passage hashes are not unique.') throw error
      adversarialRejected = true
    }
    if (!adversarialRejected) throw new Error(`${bundle.id} adversarial retained duplicate was accepted.`)
  }
  results.push({
    id: bundle.id,
    status: fixture.proofDecision.status,
    retainedPassages: fixture.proofDecision.retainedPassageCount,
    adversarialRejected,
  })
}

console.log(JSON.stringify({ valid: true, results }, null, 2))
