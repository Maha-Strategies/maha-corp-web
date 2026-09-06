import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildContextBudgetLadder,
  buildEvidenceRetentionMatrix,
  buildGovernedContextVerificationPack,
  parseContextBudgetLadderInput,
} from '../lib/x402/context-product-family.ts'
import {
  CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT,
  EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT,
  GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT,
} from '../lib/x402/context-product-offer-schemas.ts'

test('the $0.005 ladder performs exactly five deterministic compilations', () => {
  const first = buildContextBudgetLadder(CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT)
  const second = buildContextBudgetLadder(CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT)
  assert.deepEqual(second, first)
  assert.equal(first.runs.length, 5)
  assert.equal(first.economicBasis.priceBaseUnits, '5000')
  assert.match(first.receiptDigest, /^sha256:[a-f0-9]{64}$/)
})

test('budget ladders refuse anything other than five unique ascending budgets', () => {
  assert.throws(() => parseContextBudgetLadderInput({ ...CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT, tokenBudgets: [64, 128] }), /exactly 5/)
  assert.throws(() => parseContextBudgetLadderInput({ ...CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT, tokenBudgets: [64, 96, 96, 192, 256] }), /distinct values in ascending order/)
  assert.throws(() => parseContextBudgetLadderInput({ ...CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT, extra: true }), /Unknown request field/)
})

test('the $0.05 matrix performs five exact-span evaluations and emits a frontier', () => {
  const first = buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT)
  const second = buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT)
  assert.deepEqual(second, first)
  assert.equal(first.runs.length, 5)
  assert.equal(first.evidenceFrontier.length, 2)
  assert.equal(first.economicBasis.priceBaseUnits, '50000')
  assert.match(first.boundaries.join(' '), /not factual accuracy/i)
})

test('the $0.50 governed pack is deterministic and keeps its assurance boundary', () => {
  const first = buildGovernedContextVerificationPack(GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT)
  const second = buildGovernedContextVerificationPack(GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT)
  assert.deepEqual(second, first)
  assert.equal(first.offerId, 'governed-context-verification-pack')
  assert.equal(first.sourceTextStored, false)
  assert.match(first.limitations.join(' '), /not a factual or compliance certification/i)
  assert.match(first.receiptDigest, /^sha256:[a-f0-9]{64}$/)
})
