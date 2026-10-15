// Test/evidence-generation fixtures only; never imported by application code.
import { batch20Port } from '../../lib/api-v1/batch20-ports.ts'
import { fixtureDependencies } from '../../lib/x402/demand6/fixtures.ts'
import type { ExecutionCost } from '../../lib/api-v1/cost-policy.ts'
export const MOCK_MODEL_POLICY: ExecutionCost = { mode: 'external-model', expected_usdc: .001, expectedBasis: 'unmeasured-planning-assumption', maximum_external_cost_usdc: .001, costEnvelopeReviewed: true, liveModelSpendApproved: true }
export const batch20FixtureHandler = (id: string, amount: string) => batch20Port(id, amount, { demand: fixtureDependencies,
  model: { policy: MOCK_MODEL_POLICY, maximumCallCostUsd: .001, run: async (_prompt, limits) => {
    if (limits.maximumCostUsd !== .001 || limits.maximumOutputTokens !== 2048) throw Error('unexpected_mock_model_limits')
    return JSON.stringify({ claims: [{ excerpt: 'This synthetic result still needs independent source verification before publication.', tag: 'UNVERIFIED', rationale: 'Synthetic fixture; no primary evidence was checked.', action: 'verify' }] })
  } } })
