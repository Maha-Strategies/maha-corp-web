import { createHash, randomUUID } from 'node:crypto'

export const EXPERIMENT_ACTIONS = ['approve', 'mark_prepared', 'confirm_published', 'retain', 'iterate', 'retire'] as const
export type ExperimentAction = typeof EXPERIMENT_ACTIONS[number]

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}
function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new Error(`${field} must be an ISO date.`)
  return value
}
function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number.`)
  return value
}
function targetUrl(value: unknown): string {
  const parsed = line(value, 'targetUrl', 8, 2_000)
  let url: URL
  try { url = new URL(parsed) } catch { throw new Error('targetUrl must be an absolute Maha Strategies URL.') }
  if (url.protocol !== 'https:' || url.hostname !== 'www.mahastrategies.com') throw new Error('targetUrl must be an absolute www.mahastrategies.com URL.')
  return url.toString()
}

export function experimentId() { return `experiment_${randomUUID().replaceAll('-', '')}` }
export function experimentHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseExperiment(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const sourceKind = body.sourceKind
  const primaryKpi = body.primaryKpi
  if (sourceKind !== 'market_opportunity' && sourceKind !== 'search_performance' && sourceKind !== 'manual') throw new Error('sourceKind is not supported.')
  if (!['impressions', 'click_through_rate', 'inquiries', 'checkout_starts', 'paid_conversions'].includes(primaryKpi as string)) throw new Error('primaryKpi is not supported.')
  const baselineObservedOn = date(body.baselineObservedOn, 'baselineObservedOn')
  const measureAfterOn = date(body.measureAfterOn, 'measureAfterOn')
  if (measureAfterOn < baselineObservedOn) throw new Error('measureAfterOn must not be before baselineObservedOn.')
  return { sourceKind, sourceReference: line(body.sourceReference, 'sourceReference', 3, 200), hypothesis: line(body.hypothesis, 'hypothesis', 20, 1_000), targetUrl: targetUrl(body.targetUrl), intendedChange: line(body.intendedChange, 'intendedChange', 20, 1_500), callToAction: line(body.callToAction, 'callToAction', 3, 160), primaryKpi, baselineValue: amount(body.baselineValue, 'baselineValue'), baselineObservedOn, measureAfterOn, idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}

export function parseExperimentAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const action = body.action
  if (typeof action !== 'string' || !EXPERIMENT_ACTIONS.includes(action as ExperimentAction)) throw new Error('action is not supported.')
  const outcomeValue = body.outcomeValue === undefined || body.outcomeValue === '' ? null : amount(body.outcomeValue, 'outcomeValue')
  if (['retain', 'iterate', 'retire'].includes(action) && outcomeValue === null) throw new Error('outcomeValue is required when recording an outcome.')
  const parsedId = line(body.experimentId, 'experimentId', 12, 80)
  if (!/^experiment_[a-f0-9]{32}$/.test(parsedId)) throw new Error('experimentId is not valid.')
  return { experimentId: parsedId, action: action as ExperimentAction, note: body.note === undefined || body.note === '' ? '' : line(body.note, 'note', 3, 2_000), outcomeValue, idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
