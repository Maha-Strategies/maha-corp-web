import { createHash, randomUUID } from 'node:crypto'

export const MICRO_UTILITY_ACTIONS = ['approve', 'confirm_live', 'retain', 'retire'] as const
export type MicroUtilityAction = typeof MICRO_UTILITY_ACTIONS[number]

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}
function whole(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}.`)
  return value
}
export function microUtilityValidationId() { return `microval_${randomUUID().replaceAll('-', '')}` }
export function microUtilityHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseMicroUtilityValidation(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const somEvaluationId = line(body.somEvaluationId, 'somEvaluationId', 12, 80)
  const experimentId = line(body.experimentId, 'experimentId', 12, 80)
  if (!/^som_[a-f0-9]{32}$/.test(somEvaluationId)) throw new Error('somEvaluationId is not valid.')
  if (!/^experiment_[a-f0-9]{32}$/.test(experimentId)) throw new Error('experimentId is not valid.')
  if (body.utility !== 'receipts_to_csv') throw new Error('utility is not supported.')
  return { somEvaluationId, experimentId, utility: 'receipts_to_csv' as const, targetPriceCents: whole(body.targetPriceCents, 'targetPriceCents', 500, 2_000), targetPaidOrders: whole(body.targetPaidOrders, 'targetPaidOrders', 5, 100), measureDays: whole(body.measureDays, 'measureDays', 14, 45), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
export function parseMicroUtilityAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>; const validationId = line(body.validationId, 'validationId', 12, 80)
  if (!/^microval_[a-f0-9]{32}$/.test(validationId)) throw new Error('validationId is not valid.')
  if (typeof body.action !== 'string' || !MICRO_UTILITY_ACTIONS.includes(body.action as MicroUtilityAction)) throw new Error('action is not supported.')
  return { validationId, action: body.action as MicroUtilityAction, idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}

export function microUtilityLaunchPath(utility: 'receipts_to_csv', experimentId: string) { return `/utilities/receipts?exp=${experimentId}` }
