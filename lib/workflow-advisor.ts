import { offerById, offerPriceUsd, type X402Offer } from './x402/offers.ts'
import {
  selectMahaOffer,
  type OfferDecision,
  type OfferSelectionInput,
  type SelectionObjective,
} from './x402/offer-selection.ts'

export const ADVISOR_OBJECTIVES = [
  'compile-context-pack',
  'evaluate-context-quality',
  'compile-and-evaluate',
  'claim-provenance-triage',
  'summarize',
  'verify-facts',
  'other',
] as const satisfies readonly SelectionObjective[]

export type AdvisorInput = {
  workflow: string
  objective: SelectionObjective | 'auto'
  estimatedInputBytes?: number
  documentCount?: number
  requiredTokenBudget?: number
  maximumPriceBaseUnits?: string
  needsRetentionMeasurement?: boolean
  needsCitationTraceability?: boolean
  inputEncoding?: 'utf8-text' | 'binary'
  requiresGuaranteedCompleteness?: boolean
}

export type AdvisorOffer = {
  id: string
  name: string
  status: X402Offer['status']
  method: string
  path: string
  publishedPrice: string
  priceBaseUnits: string
  maxRequestBytes: number
  requestExample: Record<string, unknown>
  requiredInputFields: string[]
  requiredHeaders: X402Offer['discovery']['requiredHeaders']
  contractUrl: string
  capabilityBoundaries: string[]
  retentionNote: string
}

export type AdvisorPlan = {
  objective: SelectionObjective
  decision: OfferDecision
  offers: AdvisorOffer[]
  checksBeforePayment: string[]
  advisory: string
}

const advisory = 'This is an advisory plan, not a quote or authorization. Inspect the live 402 challenge, validate the request, and obtain human or buyer-policy approval before signing or paying.'

export function parseAdvisorInput(raw: unknown): AdvisorInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected a JSON object.')
  const value = raw as Record<string, unknown>
  if (typeof value.workflow !== 'string' || value.workflow.length > 2000) {
    throw new Error('Workflow must be text of at most 2,000 characters.')
  }
  if (typeof value.objective !== 'string' || (value.objective !== 'auto' && !ADVISOR_OBJECTIVES.includes(value.objective as SelectionObjective))) {
    throw new Error('Choose a supported objective.')
  }
  if (value.objective === 'auto' && !value.workflow.trim()) throw new Error('Describe the workflow for AI interpretation.')
  for (const field of ['estimatedInputBytes', 'documentCount', 'requiredTokenBudget'] as const) {
    const entry = value[field]
    if (entry !== undefined && (!Number.isSafeInteger(entry) || (entry as number) < 1 || (entry as number) > 10_000_000)) {
      throw new Error(`${field} must be a positive integer at most 10,000,000.`)
    }
  }
  if (value.maximumPriceBaseUnits !== undefined && (typeof value.maximumPriceBaseUnits !== 'string' || !/^\d{1,18}$/.test(value.maximumPriceBaseUnits))) {
    throw new Error('maximumPriceBaseUnits must be a decimal integer string of USDC base units.')
  }
  for (const field of ['needsRetentionMeasurement', 'needsCitationTraceability', 'requiresGuaranteedCompleteness'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') throw new Error(`${field} must be a boolean.`)
  }
  if (value.inputEncoding !== undefined && value.inputEncoding !== 'utf8-text' && value.inputEncoding !== 'binary') {
    throw new Error('inputEncoding must be utf8-text or binary.')
  }
  return value as AdvisorInput
}

export function buildAdvisorPlan(input: AdvisorInput, objective: SelectionObjective): AdvisorPlan {
  const selectionInput: OfferSelectionInput = {
    objective,
    estimatedInputBytes: input.estimatedInputBytes,
    documentCount: input.documentCount,
    requiredTokenBudget: input.requiredTokenBudget,
    maximumPriceBaseUnits: input.maximumPriceBaseUnits,
    needsRetentionMeasurement: input.needsRetentionMeasurement,
    needsCitationTraceability: input.needsCitationTraceability,
    inputEncoding: input.inputEncoding,
    requiresGuaranteedCompleteness: input.requiresGuaranteedCompleteness,
  }
  // The published selector defaults `other` to compression. The advisor cannot
  // interpret an unknown task as permission to recommend a payable product.
  const decision: OfferDecision = objective === 'other'
    ? {
        decision: 'reject', selectedOfferIds: [], estimatedOfferCostBaseUnits: '0',
        reasons: ['The workflow does not map confidently to a published offer. Clarify the required outcome before considering payment.'],
        constraintsChecked: ['capability'], rejectedAlternatives: [], warnings: [],
      }
    : selectMahaOffer(selectionInput)

  const offers = decision.selectedOfferIds.flatMap((id): AdvisorOffer[] => {
    const offer = offerById(id)
    if (!offer || offer.status !== 'available') return []
    return [{
      id: offer.id,
      name: offer.serviceName,
      status: offer.status,
      method: offer.method,
      path: offer.path,
      publishedPrice: offerPriceUsd(offer),
      priceBaseUnits: offer.amount,
      maxRequestBytes: offer.maxRequestBytes,
      requestExample: structuredClone(offer.discovery.input),
      requiredInputFields: [...((offer.discovery.inputSchema.required as string[] | undefined) ?? [])],
      requiredHeaders: offer.discovery.requiredHeaders ? structuredClone(offer.discovery.requiredHeaders) : undefined,
      contractUrl: `https://www.mahastrategies.com/api/discovery/x402-offers/${encodeURIComponent(offer.id)}`,
      capabilityBoundaries: [...offer.capabilityBoundaries],
      retentionNote: offer.retention.note,
    }]
  })

  return {
    objective, decision, offers,
    checksBeforePayment: [
      'Confirm the example is adapted to your real input and validates against the published schema. Do not send sensitive source text to this advisor.',
      'Confirm all required headers and idempotency or input-hash requirements from the offer contract.',
      'Fetch the live 402 challenge and compare its network, asset, amount, recipient, and resource with your buyer policy and spending ceiling.',
      'Obtain explicit authorization before signing. This advisor never signs, pays, or calls a paid endpoint.',
      'After any purchase, verify the response or durable receipt against the requested outcome; payment alone is not proof of delivery or correctness.',
    ],
    advisory,
  }
}
