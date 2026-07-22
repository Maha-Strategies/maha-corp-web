import { createHash, randomUUID } from 'node:crypto'

export const DEMAND_CLUSTER_STATUSES = ['collecting', 'validated', 'insufficient_evidence'] as const
export type DemandClusterStatus = typeof DEMAND_CLUSTER_STATUSES[number]

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

export function demandClusterId() { return `demand_${randomUUID().replaceAll('-', '')}` }
export function demandGateHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseDemandCluster(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (!Array.isArray(body.opportunityIds) || body.opportunityIds.length < 3 || body.opportunityIds.length > 8) throw new Error('opportunityIds must contain between 3 and 8 approved signals.')
  const opportunityIds = body.opportunityIds.map((item, index) => {
    const id = line(item, `opportunityIds[${index}]`, 12, 80)
    if (!/^mapopp_[a-f0-9]{32}$/.test(id)) throw new Error(`opportunityIds[${index}] is not valid.`)
    return id
  })
  if (new Set(opportunityIds).size !== opportunityIds.length) throw new Error('opportunityIds must be distinct.')
  return {
    title: line(body.title, 'title', 8, 180),
    buyer: line(body.buyer, 'buyer', 3, 200),
    jobToBeDone: line(body.jobToBeDone, 'jobToBeDone', 20, 600),
    offer: line(body.offer, 'offer', 10, 500),
    opportunityIds,
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120),
  }
}

export type DemandSignal = { source: string; signal_class: string; commercial_intent: number }

// This is intentionally explainable rather than predictive. A cluster needs
// three human-approved signals and two direct-demand signals before it can
// validate an offer experiment. Search visibility alone is not buyer demand.
export function scoreDemandCluster(signals: DemandSignal[]) {
  const directDemandSignals = signals.filter((signal) => signal.signal_class === 'buyer_demand' || signal.signal_class === 'marketplace_request').length
  const marketplaceSignals = signals.filter((signal) => signal.signal_class === 'marketplace_request').length
  const sourceChannels = new Set(signals.map((signal) => signal.source)).size
  const averageCommercialIntent = signals.length ? signals.reduce((total, signal) => total + signal.commercial_intent, 0) / signals.length : 0
  const evidenceScore = Math.min(30, signals.length * 10)
  const directDemandScore = Math.min(30, directDemandSignals * 15)
  const marketplaceScore = marketplaceSignals > 0 ? 15 : 0
  const channelScore = Math.min(15, Math.max(0, sourceChannels - 1) * 15)
  const commercialScore = averageCommercialIntent >= 12 ? 10 : averageCommercialIntent >= 8 ? 5 : 0
  const score = evidenceScore + directDemandScore + marketplaceScore + channelScore + commercialScore
  const status: DemandClusterStatus = signals.length >= 3 && directDemandSignals >= 2 && score >= 70 ? 'validated' : signals.length >= 3 ? 'insufficient_evidence' : 'collecting'
  return { score, status, signalCount: signals.length, directDemandSignals, marketplaceSignals, sourceChannels, averageCommercialIntent }
}
