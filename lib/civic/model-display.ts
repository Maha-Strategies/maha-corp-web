import { CIVIC_SOURCE_ARCHIVES } from './source-archives.ts'

function freezeMetadata<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeMetadata(child); Object.freeze(value) }
  return value
}

export const COST_DRIVERS = {
  systems: { label: 'Systems assessed per year', unit: 'systems', max: 10000, integer: true },
  testsPerSystem: { label: 'Tests per system', unit: 'tests/system', max: 1000, integer: true },
  hoursPerTest: { label: 'Hours per test', unit: 'hours/test', max: 1000, integer: false },
  hourlyCostUsd: { label: 'Loaded hourly cost', unit: 'USD/hour', max: 10000, integer: false },
  reportsPerYear: { label: 'Reports per year', unit: 'reports/year', max: 1000000, integer: true },
  hoursPerReport: { label: 'Hours per report', unit: 'hours/report', max: 1000, integer: false },
} as const

export const CIVIC_MODEL_CARDS = freezeMetadata([
  { id: 'procurement-linear-sensitivity', version: 'civic-simulation-1', policyId: 'epistemic-procurement-transparency',
    calibrationStatus: 'uncalibrated-illustrative', data: [], sources: CIVIC_SOURCE_ARCHIVES,
    sourceScope: 'Archived 2023 legislative context, retrieved 2026-10-04. No current-law check or empirical savings dataset.',
    method: 'baseline + adoption × supplied impact delta', limitations: ['No causal identification or independent budget score.', 'Supplied bounds have no specified statistical confidence level.'] },
  { id: 'ai-governance-accounting', version: 'civic-ai-governance-cost-1', policyId: null,
    calibrationStatus: 'uncalibrated-accounting', data: [], sources: [],
    sourceScope: 'No measured cost dataset is bundled. All numeric drivers must be supplied and labeled as assumptions.',
    method: '(systems × tests/system × hours/test + reports/year × hours/report) × USD/hour',
    limitations: ['Accounting scenario only; no forecast of adoption, effectiveness or AI-risk reduction.', 'Excludes capital, legal, overhead and opportunity costs unless represented in the supplied hourly cost.'] },
])
