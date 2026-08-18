import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildContextProofFixture,
  CONTEXT_PROOF_MAX_RETAINED_PASSAGES,
  validateContextProofFixture,
  type ContextProofFixture,
} from '../lib/context-proof-fixture.ts'
import {
  fixtureFileDigest,
  recomputeContextCompilerInputHash,
  recomputeContextCompilerOutputHash,
} from '../lib/context-proof-canonicalization.ts'
import { compileContextPack } from '../lib/context-compiler.ts'

const fixtureRoot = join(import.meta.dirname, 'fixtures', 'context-proof')
const addendumRoot = join(import.meta.dirname, 'fixtures', 'context-proof-addendum-v3.1')
const index = JSON.parse(readFileSync(join(fixtureRoot, 'index.json'), 'utf8')) as {
  bundles: Array<{ id: string; path: string; adversarialPath?: string }>
}

function fixture(path: string): ContextProofFixture {
  return JSON.parse(readFileSync(join(fixtureRoot, path), 'utf8')) as ContextProofFixture
}

test('all four proof bundles reproduce the production compiler contract', () => {
  assert.equal(index.bundles.length, 4)
  for (const bundle of index.bundles) validateContextProofFixture(fixture(bundle.path))
})

test('the proof boundary accepts 128 retained passages and rejects 129 without charging', () => {
  const boundary = fixture('boundary-n128/fixture.json')
  const unsupported = fixture('unsupported-n129/fixture.json')

  assert.equal(boundary.proofDecision.retainedPassageCount, CONTEXT_PROOF_MAX_RETAINED_PASSAGES)
  assert.equal(boundary.proofDecision.status, 'success')
  assert.equal(boundary.proofDecision.shouldAttemptProof, true)
  assert.equal(boundary.proofDecision.chargePermitted, true)

  assert.equal(unsupported.proofDecision.retainedPassageCount, CONTEXT_PROOF_MAX_RETAINED_PASSAGES + 1)
  assert.equal(unsupported.proofDecision.status, 'unsupported_passage_count')
  assert.equal(unsupported.proofDecision.shouldAttemptProof, false)
  assert.equal(unsupported.proofDecision.chargePermitted, false)
  assert.equal(unsupported.expectedPublicValues, null)
})

test('the retained-set duplicate adversary is rejected', () => {
  const adversarial = fixture('duplicate-retained-set/adversarial-retained-duplicate.json')
  assert.equal(adversarial.proofDecision.status, 'rejected_invalid_retained_set')
  assert.equal(adversarial.proofDecision.retainedPassageCount, 5)
  assert.equal(adversarial.proofDecision.shouldAttemptProof, false)
  assert.equal(adversarial.proofDecision.chargePermitted, false)
  assert.equal(adversarial.expectedPublicValues, null)
  assert.throws(() => validateContextProofFixture(adversarial), /Retained passage hashes are not unique/)
})

test('the sidecar does not add proof fields to the public Context Compiler response', () => {
  const proofFixture = fixture('duplicate-retained-set/fixture.json')
  const pack = compileContextPack({
    clientRequestId: 'public_response_shape_guard',
    ...proofFixture.privateWitness.request,
  })
  const response = pack as unknown as Record<string, unknown>

  assert.equal('proofDecision' in response, false)
  assert.equal('expectedPublicValues' in response, false)
  assert.equal('privateWitness' in response, false)
  for (const passage of pack.includedPassages) {
    assert.equal('sourceStartByte' in passage, false)
    assert.equal('sourceEndByte' in passage, false)
  }
})

test('public proof values preserve explicit token-estimator non-claims', () => {
  for (const path of ['representative-n70/fixture.json', 'boundary-n128/fixture.json', 'duplicate-retained-set/fixture.json']) {
    const publicValues = fixture(path).expectedPublicValues
    assert.ok(publicValues)
    assert.equal(publicValues.reportedTokenArithmeticValid, true)
    assert.equal(publicValues.tokenEstimatorVerified, false)
    assert.equal(publicValues.providerTokenBudgetGuaranteed, false)
    assert.equal(publicValues.tokenEstimatorVersion, 'maha_model_neutral_v1')
  }
})

test('the sidecar preserves an omitted document title when reproducing inputHash', () => {
  const proofFixture = buildContextProofFixture({
    fixtureId: 'untitled-document',
    description: 'A valid request whose optional source title is deliberately omitted.',
    request: {
      clientRequestId: 'proof_fixture_untitled_document',
      task: 'Retain the release condition from this untitled source document.',
      tokenBudget: 256,
      documents: [{ id: 'untitled-source', text: 'Release requires a passing canary and signed rotation evidence.' }],
      provenance: 'compact',
      scoring: 'bm25',
      budgetMode: 'guaranteed',
    },
  })

  assert.equal(proofFixture.privateWitness.request.documents[0].title, undefined)
  validateContextProofFixture(proofFixture)
})

test('the canonicalization addendum does not mutate the validated checkpoint', () => {
  const addendum = JSON.parse(readFileSync(join(addendumRoot, 'index.json'), 'utf8')) as {
    frozenCheckpointSha256: Record<string, string>
  }
  for (const [path, digest] of Object.entries(addendum.frozenCheckpointSha256)) {
    assert.equal(fixtureFileDigest(readFileSync(join(fixtureRoot, path))), digest, path)
  }
})

test('production input and output commitments follow the executable preimage rules', () => {
  for (const path of ['representative-n70/fixture.json', 'boundary-n128/fixture.json', 'duplicate-retained-set/fixture.json']) {
    const proofFixture = fixture(path)
    assert.equal(recomputeContextCompilerInputHash(proofFixture.privateWitness.request), proofFixture.compilerCommitments.inputHash)
    assert.equal(recomputeContextCompilerOutputHash(proofFixture.privateWitness.compiledContext), proofFixture.compilerCommitments.outputHash)
  }
})

test('the input commitment excludes only the documented production fields', () => {
  const proofFixture = fixture('duplicate-retained-set/fixture.json')
  const request = proofFixture.privateWitness.request
  const original = recomputeContextCompilerInputHash(request)
  const changedRouting = { ...request, provenance: 'none' as const, scoring: 'keyword' as const, budgetMode: 'estimated' as const }
  assert.equal(recomputeContextCompilerInputHash(changedRouting), original)
  assert.notEqual(recomputeContextCompilerInputHash({ ...request, tokenBudget: request.tokenBudget + 1 }), original)
  assert.notEqual(recomputeContextCompilerInputHash({ ...request, task: `${request.task} Additional constraint.` }), original)
})

test('partial coverage is independently reproduced as three of four sources', () => {
  const partial = JSON.parse(readFileSync(join(addendumRoot, 'partial-coverage-3-of-4', 'fixture.json'), 'utf8')) as ContextProofFixture
  validateContextProofFixture(partial)
  assert.ok(partial.expectedPublicValues)
  assert.equal(partial.expectedPublicValues.coverageNumerator, 3)
  assert.equal(partial.expectedPublicValues.coverageDenominator, 4)
  assert.equal(partial.expectedPublicValues.coveragePercentageBps, 7_500)
  assert.deepEqual(new Set(partial.privateWitness.retainedPassageIdsInOutputOrder.map((id) => id.split(':')[0])), new Set(['release', 'rotation', 'rollback']))
})
