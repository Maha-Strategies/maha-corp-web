export type ExecutionCost = { mode: 'local-cpu-wasm' | 'external-source-read' | 'external-model' | 'unreviewed';
  expected_usdc: number; expectedBasis: 'unmeasured-planning-assumption'; maximum_external_cost_usdc: number | null;
  costEnvelopeReviewed: boolean; liveModelSpendApproved: boolean }
export const MODEL_PRICE_MULTIPLIER = 3
const finiteCost = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1000000
export const minimumModelPriceUnits = (cost: number) => {
  if (!finiteCost(cost) || cost <= 0) throw Error('invalid_expected_model_cost')
  return Math.ceil(cost * MODEL_PRICE_MULTIPLIER * 1000000)
}
export function assertExecutionCost(amount: string, c: ExecutionCost | undefined) {
  if (!/^[1-9][0-9]*$/.test(amount) || !Number.isSafeInteger(Number(amount)) || !c || !['local-cpu-wasm', 'external-source-read', 'external-model', 'unreviewed'].includes(c.mode)
    || !finiteCost(c.expected_usdc) || c.expectedBasis !== 'unmeasured-planning-assumption'
    || typeof c.costEnvelopeReviewed !== 'boolean' || typeof c.liveModelSpendApproved !== 'boolean'
    || c.maximum_external_cost_usdc !== null && !finiteCost(c.maximum_external_cost_usdc)) throw Error('invalid_execution_cost_policy')
  if (c.mode === 'external-model') {
    if (Number(amount) < minimumModelPriceUnits(c.expected_usdc)) throw Error('model_price_below_three_times_expected_cost')
    if (c.maximum_external_cost_usdc !== null && (c.maximum_external_cost_usdc < c.expected_usdc
      || Number(amount) < minimumModelPriceUnits(c.maximum_external_cost_usdc))) throw Error('model_cost_envelope_exceeds_price')
  } else if (c.liveModelSpendApproved || c.maximum_external_cost_usdc !== null) throw Error('model_budget_on_non_model_handler')
}
export function executionCostFor(e: { id: string; status: string; estimated_compute_cost: number }): ExecutionCost {
  const mode: ExecutionCost['mode'] = e.id === 'mps-autonomous-audit' ? 'external-model'
    : e.status !== 'local-implemented' ? 'unreviewed'
    : e.id.startsWith('research-') && ['research-publication-update-snapshot', 'research-data-software-links', 'research-funding-lineage',
      'research-bibliography-resolution', 'research-trial-status-snapshot'].includes(e.id) ? 'external-source-read' : 'local-cpu-wasm'
  return { mode, expected_usdc: e.estimated_compute_cost, expectedBasis: 'unmeasured-planning-assumption',
    maximum_external_cost_usdc: null, costEnvelopeReviewed: false, liveModelSpendApproved: false }
}
export function executionCostReleaseBlock(c: ExecutionCost | undefined) {
  if (!c || c.mode === 'unreviewed') return 'execution_cost_profile_unreviewed_no_payment'
  if (c.mode === 'external-model' && (!c.liveModelSpendApproved || !c.costEnvelopeReviewed || c.maximum_external_cost_usdc === null)) return 'model_spend_or_cost_envelope_unapproved_no_payment'
  return null
}
/** Reserve provider-bill exposure before the caller invokes a model. No refund
 * on failure: a timed-out provider may still bill. Pricing is not authorization. */
export function createModelCostBudget(amount: string, policy: ExecutionCost) {
  assertExecutionCost(amount, policy)
  if (policy.mode !== 'external-model' || executionCostReleaseBlock(policy)) throw Error('model_budget_not_approved')
  const maximum = Math.floor(policy.maximum_external_cost_usdc! * 1000000)
  let reserved = 0
  return { reserve(costUpperBound: number) {
    if (!finiteCost(costUpperBound) || costUpperBound <= 0) throw Error('invalid_model_call_cost_bound')
    const units = Math.ceil(costUpperBound * 1000000)
    if (units > maximum - reserved) throw Error('model_call_budget_exceeded_before_invocation')
    reserved += units
  }, get reservedUsd() { return reserved / 1000000 }, get maximumUsd() { return maximum / 1000000 } }
}
