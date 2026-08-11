export const NAVIGATOR_COMMERCIAL_STAGES = [
  'discovered',
  'recommendation_approved',
  'message_sent',
  'reply_received',
  'offer_inspected',
  'payment_confirmed',
  'delivery_succeeded',
  'repeat_purchase',
] as const

export const NAVIGATOR_OPERATOR_STAGES = [
  'message_sent',
  'reply_received',
  'offer_inspected',
  'payment_confirmed',
  'delivery_succeeded',
] as const

export const NAVIGATOR_COMMERCIAL_CHANNELS = ['email', 'linkedin', 'reddit', 'registry', 'direct', 'other'] as const

export type NavigatorCommercialStage = typeof NAVIGATOR_COMMERCIAL_STAGES[number]
export type NavigatorOperatorStage = typeof NAVIGATOR_OPERATOR_STAGES[number]
export type NavigatorCommercialChannel = typeof NAVIGATOR_COMMERCIAL_CHANNELS[number]

export type NavigatorCommercialEventRow = {
  candidate_id: string
  stage: NavigatorCommercialStage
  offer_id: string | null
  channel: NavigatorCommercialChannel | null
  reference_hash: string | null
  created_at: string
}

export type NavigatorCommercialOperation = {
  candidateId: string
  stage: NavigatorOperatorStage
  channel: NavigatorCommercialChannel | null
  offerId: string | null
  referenceId: string | null
  idempotencyKey: string
}

function line(value: unknown, name: string, min: number, max: number, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === '')) return null
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

export function parseNavigatorCommercialOperation(value: unknown): NavigatorCommercialOperation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const candidateId = line(body.candidateId, 'candidateId', 40, 40)!
  if (!/^navacct_[a-f0-9]{32}$/.test(candidateId)) throw new Error('candidateId is invalid.')
  if (typeof body.stage !== 'string' || !NAVIGATOR_OPERATOR_STAGES.includes(body.stage as NavigatorOperatorStage)) throw new Error('stage is not an operator-recordable commercial stage.')
  const stage = body.stage as NavigatorOperatorStage
  const channel = line(body.channel, 'channel', 3, 24, true)
  if (channel !== null && !NAVIGATOR_COMMERCIAL_CHANNELS.includes(channel as NavigatorCommercialChannel)) throw new Error('channel is not supported.')
  const offerId = line(body.offerId, 'offerId', 3, 160, true)
  const referenceId = line(body.referenceId, 'referenceId', 3, 500, true)
  if ((stage === 'message_sent' || stage === 'reply_received') && channel === null) throw new Error(`${stage} requires channel.`)
  if ((stage === 'offer_inspected' || stage === 'payment_confirmed' || stage === 'delivery_succeeded') && offerId === null) throw new Error(`${stage} requires offerId.`)
  if ((stage === 'payment_confirmed' || stage === 'delivery_succeeded') && referenceId === null) throw new Error(`${stage} requires referenceId.`)
  return {
    candidateId,
    stage,
    channel: channel as NavigatorCommercialChannel | null,
    offerId,
    referenceId,
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120)!,
  }
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(4))
}

function camel(stage: NavigatorCommercialStage): string {
  return stage.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export function buildNavigatorCommercialFunnel(rows: NavigatorCommercialEventRow[]) {
  const candidatesByStage = new Map<NavigatorCommercialStage, Set<string>>(
    NAVIGATOR_COMMERCIAL_STAGES.map((stage) => [stage, new Set<string>()]),
  )
  const paymentReferences = new Set<string>()
  for (const row of rows) {
    candidatesByStage.get(row.stage)?.add(row.candidate_id)
    if (row.stage === 'payment_confirmed' && row.reference_hash) paymentReferences.add(row.reference_hash)
  }
  const stages = Object.fromEntries(NAVIGATOR_COMMERCIAL_STAGES.map((stage) => [stage, candidatesByStage.get(stage)?.size ?? 0])) as Record<NavigatorCommercialStage, number>
  const conversions = Object.fromEntries(NAVIGATOR_COMMERCIAL_STAGES.slice(1).map((stage, index) => {
    const previous = NAVIGATOR_COMMERCIAL_STAGES[index]
    const next = camel(stage)
    return [`${camel(previous)}To${next[0].toUpperCase()}${next.slice(1)}`, ratio(stages[stage], stages[previous])]
  }))
  return {
    unit: 'distinct_prospects' as const,
    stages,
    conversions,
    confirmedPayments: paymentReferences.size,
    interpretation: 'Prospect-scoped stage reach from explicit evidence. Discovery and pursue approval are recorded automatically; later stages require an operator-supplied attribution. A missing event is unknown, not proof that the action did not occur.',
  }
}
