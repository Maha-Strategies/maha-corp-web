import { createHash, randomUUID } from 'node:crypto'

export type SomDecision = 'build_candidate' | 'validate_first' | 'reject'

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}.`)
  return value
}
function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

export function somEvaluationId() { return `som_${randomUUID().replaceAll('-', '')}` }
export function somHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export type SomEvaluationInput = {
  demandClusterId: string; priceCents: number; variableCostCents: number; monthlyOperatingCostCents: number; oneTimeBuildCostCents: number
  expectedMonthlyQualifiedDemand: number; expectedConversionRateBps: number; competitorPressure: number; willingnessToPayEvidence: number; policyRisk: number; assumptionNote: string; idempotencyKey: string
}

export function parseSomEvaluation(value: unknown): SomEvaluationInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const demandClusterId = line(body.demandClusterId, 'demandClusterId', 12, 80)
  if (!/^demand_[a-f0-9]{32}$/.test(demandClusterId)) throw new Error('demandClusterId is not valid.')
  return {
    demandClusterId,
    priceCents: integer(body.priceCents, 'priceCents', 100, 10_000_000),
    variableCostCents: integer(body.variableCostCents, 'variableCostCents', 0, 10_000_000),
    monthlyOperatingCostCents: integer(body.monthlyOperatingCostCents, 'monthlyOperatingCostCents', 0, 100_000_000),
    oneTimeBuildCostCents: integer(body.oneTimeBuildCostCents, 'oneTimeBuildCostCents', 0, 100_000_000),
    expectedMonthlyQualifiedDemand: integer(body.expectedMonthlyQualifiedDemand, 'expectedMonthlyQualifiedDemand', 0, 1_000_000),
    expectedConversionRateBps: integer(body.expectedConversionRateBps, 'expectedConversionRateBps', 1, 10_000),
    competitorPressure: integer(body.competitorPressure, 'competitorPressure', 0, 10),
    willingnessToPayEvidence: integer(body.willingnessToPayEvidence, 'willingnessToPayEvidence', 0, 10),
    policyRisk: integer(body.policyRisk, 'policyRisk', 0, 10),
    assumptionNote: line(body.assumptionNote, 'assumptionNote', 30, 1_000),
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120),
  }
}

// All amounts are USD cents. Demand and conversion are deliberately stated as
// operator assumptions, not observed revenue or fabricated market size.
export function evaluateSom(input: Omit<SomEvaluationInput, 'demandClusterId' | 'idempotencyKey'>, demandClusterScore: number) {
  const expectedMonthlyOrders = input.expectedMonthlyQualifiedDemand * input.expectedConversionRateBps / 10_000
  const expectedMonthlyRevenueCents = expectedMonthlyOrders * input.priceCents
  const expectedMonthlyContributionCents = expectedMonthlyRevenueCents - expectedMonthlyOrders * input.variableCostCents - input.monthlyOperatingCostCents
  const grossMarginPercent = ((input.priceCents - input.variableCostCents) / input.priceCents) * 100
  const paybackMonths = expectedMonthlyContributionCents > 0 ? input.oneTimeBuildCostCents / expectedMonthlyContributionCents : null
  const score = Math.max(0, Math.min(100,
    Math.round(demandClusterScore * 0.3)
    + (expectedMonthlyContributionCents > 0 ? 15 : 0)
    + (grossMarginPercent >= 70 ? 15 : grossMarginPercent >= 50 ? 10 : 0)
    + (paybackMonths !== null && paybackMonths <= 6 ? 15 : paybackMonths !== null && paybackMonths <= 12 ? 10 : 0)
    + input.willingnessToPayEvidence
    + (10 - input.competitorPressure)
    + (10 - input.policyRisk),
  ))
  const decision: SomDecision = input.policyRisk >= 8 || expectedMonthlyContributionCents <= 0 || grossMarginPercent < 30
    ? 'reject'
    : input.willingnessToPayEvidence < 5 || input.expectedMonthlyQualifiedDemand < 5 || paybackMonths === null || paybackMonths > 12 || input.policyRisk > 4
      ? 'validate_first'
      : 'build_candidate'
  return { expectedMonthlyOrders, expectedMonthlyRevenueCents, expectedMonthlyContributionCents, grossMarginPercent, paybackMonths, score, decision }
}
