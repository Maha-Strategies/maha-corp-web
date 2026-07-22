import assert from 'node:assert/strict'
import test from 'node:test'
import { microUtilityHash, microUtilityLaunchPath, microUtilityValidationId, parseMicroUtilityValidation } from '../lib/micro-utility-validation.ts'

test('records a bounded $10 receipt utility validation with an attributable launch URL', () => {
  const experimentId = 'experiment_1234567890abcdef1234567890abcdef'
  const parsed = parseMicroUtilityValidation({ somEvaluationId: 'som_1234567890abcdef1234567890abcdef', experimentId, utility: 'receipts_to_csv', targetPriceCents: 1000, targetPaidOrders: 5, measureDays: 28, idempotencyKey: 'micro-utility-launch-001' })
  assert.equal(parsed.targetPaidOrders, 5)
  assert.equal(microUtilityLaunchPath(parsed.utility, experimentId), `/utilities/receipts?exp=${experimentId}`)
  assert.match(microUtilityValidationId(), /^microval_[a-f0-9]{32}$/)
  assert.match(microUtilityHash(parsed.idempotencyKey), /^sha256:[a-f0-9]{64}$/)
})
