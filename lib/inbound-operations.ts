import { createHash, timingSafeEqual } from 'node:crypto'

export const INBOUND_OPERATION_ACTIONS = ['start_review', 'request_clarification', 'approve_for_scoping', 'refer_to_checkout', 'decline', 'close_lost'] as const
export type InboundOperationAction = typeof INBOUND_OPERATION_ACTIONS[number]

export function inboundOperationsAuthorized(request: Request): { authorized: boolean; actorFingerprint?: string } {
  const token = process.env.INBOUND_OPERATIONS_TOKEN
  const value = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !value) return { authorized: false }
  const expected = Buffer.from(token), actual = Buffer.from(value)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { authorized: false }
  return { authorized: true, actorFingerprint: `sha256:${createHash('sha256').update(token).digest('hex')}` }
}

function line(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

export function inboundOperationHash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function parseInboundOperation(value: unknown): { submissionId: string; action: InboundOperationAction; note: string; idempotencyKey: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const submissionId = line(body.submissionId, 'submissionId', 7, 80)
  if (!/^inbound_[a-f0-9]{32}$/.test(submissionId)) throw new Error('submissionId is not valid.')
  if (typeof body.action !== 'string' || !INBOUND_OPERATION_ACTIONS.includes(body.action as InboundOperationAction)) throw new Error('action is not supported.')
  const note = body.note === undefined || body.note === null || body.note === '' ? '' : line(body.note, 'note', 1, 2_000)
  return { submissionId, action: body.action as InboundOperationAction, note, idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
