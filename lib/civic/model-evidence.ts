import { z } from 'zod'
import { civicDigest, immutableSnapshot } from './receipt.ts'
import { COST_DRIVERS, CIVIC_MODEL_CARDS } from './model-display.ts'
export { COST_DRIVERS, CIVIC_MODEL_CARDS } from './model-display.ts'
import { evidenceSourceSchema } from './workspace-types.ts'

export const costScenarioSchema = z.object({
  systems: z.number().int().min(0).max(10000), testsPerSystem: z.number().int().min(0).max(1000),
  hoursPerTest: z.number().finite().min(0).max(1000), hourlyCostUsd: z.number().finite().min(0).max(10000),
  reportsPerYear: z.number().int().min(0).max(1000000), hoursPerReport: z.number().finite().min(0).max(1000),
}).strict()
export type CostScenario = z.infer<typeof costScenarioSchema>
const observations = z.array(z.object({
  id: z.string().trim().min(1).max(100), observedOn: z.iso.date(), scenario: costScenarioSchema,
  observedAnnualCostUsd: z.number().finite().min(0).max(1000000000000000), source: evidenceSourceSchema,
}).strict()).max(100)
export const costEvidenceInputSchema = z.object({
  scenario: costScenarioSchema, origin: z.enum(['user-assumptions', 'synthetic-worked-example']),
  ranges: z.record(z.string(), z.tuple([z.number().finite(), z.number().finite()])).default({}),
  observations: observations.default([]),
}).strict().superRefine((input, ctx) => {
  for (const [key, bounds] of Object.entries(input.ranges)) {
    const driver = COST_DRIVERS[key as keyof CostScenario], baseline = input.scenario[key as keyof CostScenario]
    if (!Object.hasOwn(COST_DRIVERS, key) || !driver || bounds[0] < 0 || bounds[1] > driver.max || bounds[0] > baseline || bounds[1] < baseline || (driver.integer && bounds.some(value => !Number.isInteger(value)))) ctx.addIssue({ code: 'custom', message: 'Each sensitivity range must be valid for its driver and contain the supplied assumption.' })
  }
  if (new Set(input.observations.map(row => row.id)).size !== input.observations.length) ctx.addIssue({ code: 'custom', message: 'Calibration observation IDs must be unique.' })
})
export function calculateGovernanceCost(input: CostScenario) {
  const scenario = costScenarioSchema.parse(input)
  const testingHours = scenario.systems * scenario.testsPerSystem * scenario.hoursPerTest
  const reportingHours = scenario.reportsPerYear * scenario.hoursPerReport
  return { testingHours, reportingHours, annualCostUsd: (testingHours + reportingHours) * scenario.hourlyCostUsd }
}
export function evaluateCostEvidence(value: unknown) {
  const input = costEvidenceInputSchema.parse(value), result = calculateGovernanceCost(input.scenario)
  const sensitivity = (Object.keys(COST_DRIVERS) as (keyof CostScenario)[]).map(key => {
    const driver = COST_DRIVERS[key], base = input.scenario[key]
    const defaultLow = Math.max(0, base * .8), defaultHigh = Math.min(driver.max, base * 1.2)
    const [low, high] = input.ranges[key] ?? [driver.integer ? Math.floor(defaultLow) : defaultLow, driver.integer ? Math.ceil(defaultHigh) : defaultHigh]
    return { driver: key, unit: driver.unit, low, high, lowCostUsd: calculateGovernanceCost({ ...input.scenario, [key]: low }).annualCostUsd,
      highCostUsd: calculateGovernanceCost({ ...input.scenario, [key]: high }).annualCostUsd,
      rangeBasis: input.ranges[key] ? 'user-supplied-range' : 'mechanical-plus-minus-20-percent-not-probabilistic' }
  })
  const errors = input.observations.map(row => ({ id: row.id, predictedUsd: calculateGovernanceCost(row.scenario).annualCostUsd,
    observedUsd: row.observedAnnualCostUsd, errorUsd: calculateGovernanceCost(row.scenario).annualCostUsd - row.observedAnnualCostUsd }))
  const payload = { version: 'civic-ai-governance-cost-1', modelCardDigest: civicDigest(CIVIC_MODEL_CARDS[1]), input, result, sensitivity,
    calibration: { status: errors.length ? 'user-supplied-unverified-diagnostic' : 'no-observations', observations: errors.length,
      datasetDigest: civicDigest(input.observations), meanAbsoluteErrorUsd: errors.length ? errors.reduce((sum, row) => sum + Math.abs(row.errorUsd), 0) / errors.length : null,
      rootMeanSquaredErrorUsd: errors.length ? Math.sqrt(errors.reduce((sum, row) => sum + row.errorUsd ** 2, 0) / errors.length) : null, residuals: errors },
    limitation: 'Conditional cost arithmetic, not empirical policy impact or safety effectiveness. Observation provenance is user supplied and unverified; fit diagnostics do not establish external validity. Sensitivity ranges are not confidence intervals.',
  }
  return immutableSnapshot({ ...payload, digest: civicDigest(payload) })
}
export type CostEvidenceReceipt = ReturnType<typeof evaluateCostEvidence>
