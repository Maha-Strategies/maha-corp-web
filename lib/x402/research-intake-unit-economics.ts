import { MAX_AUDIT_PASSAGE_CHARS } from './mps-audit-job.ts'
import {
  CONSERVATIVE_FAILURE_RATE,
  CONSERVATIVE_TOKENS_PER_CHAR,
  EXPECTED_FAILURE_RATE,
  EXPECTED_TOKENS_PER_CHAR,
  FACILITATOR_ALLOWANCE_USD,
  INFRASTRUCTURE_ALLOWANCE_USD,
  expectedRetryMultiplier,
  modelCost,
} from './mps-unit-economics.ts'
import { RESEARCH_INTAKE_EVIDENCE_PACK_OFFER, USDC_DECIMALS } from './offers.ts'
import { RESEARCH_INTAKE_MAX_SECTIONS } from '../research-intake-evidence-pack.ts'

export const RESEARCH_INTAKE_MINIMUM_CONSERVATIVE_MARGIN_PERCENT = 30

export type ResearchIntakeEconomics = {
  scenario: string
  priceUsd: number
  sectionCount: number
  expectedModelCalls: number
  modelCostUsd: number
  infrastructureUsd: number
  facilitatorUsd: number
  totalVariableCostUsd: number
  contributionUsd: number
  marginPercent: number
  promotable: boolean
}

export function researchIntakeEconomics(options: {
  scenario: string
  sectionCount?: number
  passageChars?: number
  tokensPerChar?: number
  failureRate?: number
}): ResearchIntakeEconomics {
  const sectionCount = options.sectionCount ?? RESEARCH_INTAKE_MAX_SECTIONS
  if (!Number.isInteger(sectionCount) || sectionCount < 1 || sectionCount > RESEARCH_INTAKE_MAX_SECTIONS) {
    throw new Error(`sectionCount must be 1-${RESEARCH_INTAKE_MAX_SECTIONS}.`)
  }
  const perSection = modelCost(options.passageChars ?? MAX_AUDIT_PASSAGE_CHARS, options.scenario, options.tokensPerChar)
  // Recovery is section-local. The multiplier prices retries for each failed
  // section; successful siblings are never charged to the model again.
  const expectedModelCalls = sectionCount * expectedRetryMultiplier(options.failureRate)
  const modelCostUsd = perSection.modelCostUsd * expectedModelCalls
  const infrastructureUsd = INFRASTRUCTURE_ALLOWANCE_USD * sectionCount
  const facilitatorUsd = FACILITATOR_ALLOWANCE_USD
  const totalVariableCostUsd = modelCostUsd + infrastructureUsd + facilitatorUsd
  const priceUsd = Number(RESEARCH_INTAKE_EVIDENCE_PACK_OFFER.amount) / 10 ** USDC_DECIMALS
  const contributionUsd = priceUsd - totalVariableCostUsd
  const marginPercent = (contributionUsd / priceUsd) * 100
  return {
    scenario: options.scenario,
    priceUsd,
    sectionCount,
    expectedModelCalls,
    modelCostUsd,
    infrastructureUsd,
    facilitatorUsd,
    totalVariableCostUsd,
    contributionUsd,
    marginPercent,
    promotable: marginPercent >= RESEARCH_INTAKE_MINIMUM_CONSERVATIVE_MARGIN_PERCENT,
  }
}

export const EXPECTED_RESEARCH_INTAKE_ECONOMICS = () => researchIntakeEconomics({
  scenario: 'ten full sections, expected case',
  tokensPerChar: EXPECTED_TOKENS_PER_CHAR,
  failureRate: EXPECTED_FAILURE_RATE,
})

export const CONSERVATIVE_RESEARCH_INTAKE_ECONOMICS = () => researchIntakeEconomics({
  scenario: 'ten full sections, conservative case',
  tokensPerChar: CONSERVATIVE_TOKENS_PER_CHAR,
  failureRate: CONSERVATIVE_FAILURE_RATE,
})
