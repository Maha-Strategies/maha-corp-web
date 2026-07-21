import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

export const MARKET_SIGNAL_SOURCES = ['search_console', 'llm_query', 'freelance_market', 'manual_research', 'outbound_scout'] as const
export type MarketSignalSource = typeof MARKET_SIGNAL_SOURCES[number]
export const MARKET_OPPORTUNITY_ACTIONS = ['start_review', 'approve_experiment', 'reject', 'archive'] as const
export type MarketOpportunityAction = typeof MARKET_OPPORTUNITY_ACTIONS[number]

export type Evidence = { url: string; note: string }
export type MarketOpportunityInput = {
  source: MarketSignalSource
  sourceReference: string
  title: string
  problem: string
  buyer: string
  proposedSolution: string
  evidence: Evidence[]
  demandEvidence: number
  commercialIntent: number
  capabilityFit: number
  speedToValidate: number
  riskPenalty: number
}

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

function score(value: unknown, field: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maximum) throw new Error(`${field} must be an integer between 0 and ${maximum}.`)
  return value
}

function evidence(value: unknown): Evidence[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new Error('evidence must contain between 1 and 5 sources.')
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`evidence[${index}] must be an object.`)
    const record = item as Record<string, unknown>
    const rawUrl = line(record.url, `evidence[${index}].url`, 8, 2_000)
    let url: URL
    try { url = new URL(rawUrl) } catch { throw new Error(`evidence[${index}].url must be an absolute HTTPS URL.`) }
    if (url.protocol !== 'https:') throw new Error(`evidence[${index}].url must be an absolute HTTPS URL.`)
    return { url: url.toString(), note: line(record.note, `evidence[${index}].note`, 3, 500) }
  })
}

export function parseMarketOpportunity(value: unknown): MarketOpportunityInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.source !== 'string' || !MARKET_SIGNAL_SOURCES.includes(body.source as MarketSignalSource)) throw new Error('source is not supported.')
  return {
    source: body.source as MarketSignalSource,
    sourceReference: line(body.sourceReference, 'sourceReference', 3, 200),
    title: line(body.title, 'title', 8, 180),
    problem: line(body.problem, 'problem', 20, 1_500),
    buyer: line(body.buyer, 'buyer', 3, 200),
    proposedSolution: line(body.proposedSolution, 'proposedSolution', 20, 1_500),
    evidence: evidence(body.evidence),
    demandEvidence: score(body.demandEvidence, 'demandEvidence', 30),
    commercialIntent: score(body.commercialIntent, 'commercialIntent', 25),
    capabilityFit: score(body.capabilityFit, 'capabilityFit', 20),
    speedToValidate: score(body.speedToValidate, 'speedToValidate', 15),
    riskPenalty: score(body.riskPenalty, 'riskPenalty', 20),
  }
}

export function marketOpportunityScore(input: Pick<MarketOpportunityInput, 'demandEvidence' | 'commercialIntent' | 'capabilityFit' | 'speedToValidate' | 'riskPenalty'>): number {
  return input.demandEvidence + input.commercialIntent + input.capabilityFit + input.speedToValidate - input.riskPenalty
}

export function createMarketOpportunityId(): string { return `mapopp_${randomUUID().replaceAll('-', '')}` }
export function marketMappingHash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function authorizeMarketMapping(request: Request): { authorized: boolean; actorFingerprint?: string } {
  const token = process.env.MARKET_MAPPING_TOKEN
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !presented) return { authorized: false }
  const expected = Buffer.from(token), actual = Buffer.from(presented)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { authorized: false }
  return { authorized: true, actorFingerprint: marketMappingHash(token) }
}

export function parseMarketOperation(value: unknown): { opportunityId: string; action: MarketOpportunityAction; note: string; idempotencyKey: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const opportunityId = line(body.opportunityId, 'opportunityId', 7, 80)
  if (!/^mapopp_[a-f0-9]{32}$/.test(opportunityId)) throw new Error('opportunityId is not valid.')
  if (typeof body.action !== 'string' || !MARKET_OPPORTUNITY_ACTIONS.includes(body.action as MarketOpportunityAction)) throw new Error('action is not supported.')
  return { opportunityId, action: body.action as MarketOpportunityAction, note: body.note === undefined || body.note === '' ? '' : line(body.note, 'note', 3, 2_000), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
