import { timingSafeEqual } from 'node:crypto'

import { signOpsAlert } from './contracts.ts'

const EVENT_ID = /^alert_[a-f0-9]{32}$/
const TENANT_ID = /^[A-Za-z0-9_-]{1,160}$/
const ALLOWED_EVENTS = new Set(['tenant.low_credit', 'mcp.upstream_connectivity_failure'])
const MAX_EVENT_AGE_MS = 15 * 60 * 1_000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000

export type ReceivedOpsAlert = {
  schema: 'maha.ops-alert.v1'
  event: 'tenant.low_credit' | 'mcp.upstream_connectivity_failure'
  eventId: string
  occurredAt: string
  tenantId: string
  data: Record<string, string | number | boolean>
}

function signatureMatches(body: string, provided: string | null, secret: string) {
  if (!/^sha256=[a-f0-9]{64}$/.test(provided ?? '')) return false
  const expected = Buffer.from(signOpsAlert(body, secret), 'utf8')
  const actual = Buffer.from(provided!, 'utf8')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function parseData(value: unknown): Record<string, string | number | boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Alert data must be an object.')
  const entries = Object.entries(value)
  if (entries.length > 32) throw new Error('Alert data contains too many fields.')
  for (const [key, item] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw new Error('Alert data contains an invalid field name.')
    if (typeof item === 'string' && item.length <= 512) continue
    if (typeof item === 'boolean') continue
    if (typeof item === 'number' && Number.isFinite(item)) continue
    throw new Error('Alert data contains an invalid value.')
  }
  return Object.fromEntries(entries) as Record<string, string | number | boolean>
}

export function receiveOpsAlert(body: string, headers: Headers, secret: string, now = Date.now()): ReceivedOpsAlert {
  if (Buffer.byteLength(secret, 'utf8') < 32 || Buffer.byteLength(secret, 'utf8') > 4_096) throw new Error('Operations alert receiver is not configured.')
  if (!signatureMatches(body, headers.get('x-maha-alert-signature'), secret)) throw new Error('Alert signature is invalid.')

  let value: unknown
  try { value = JSON.parse(body) } catch { throw new Error('Alert body must be valid JSON.') }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Alert body must be an object.')
  const alert = value as Record<string, unknown>
  if (alert.schema !== 'maha.ops-alert.v1') throw new Error('Alert schema is invalid.')
  if (typeof alert.event !== 'string' || !ALLOWED_EVENTS.has(alert.event)) throw new Error('Alert event is invalid.')
  if (typeof alert.eventId !== 'string' || !EVENT_ID.test(alert.eventId)) throw new Error('Alert ID is invalid.')
  if (headers.get('x-maha-alert-id') !== alert.eventId || headers.get('x-maha-alert-event') !== alert.event) throw new Error('Alert headers do not match the signed body.')
  if (typeof alert.tenantId !== 'string' || !TENANT_ID.test(alert.tenantId)) throw new Error('Alert tenant is invalid.')
  if (typeof alert.occurredAt !== 'string') throw new Error('Alert timestamp is invalid.')
  const occurredAt = Date.parse(alert.occurredAt)
  if (!Number.isFinite(occurredAt) || occurredAt < now - MAX_EVENT_AGE_MS || occurredAt > now + MAX_CLOCK_SKEW_MS) throw new Error('Alert timestamp is outside the delivery window.')

  return {
    schema: 'maha.ops-alert.v1',
    event: alert.event as ReceivedOpsAlert['event'],
    eventId: alert.eventId,
    occurredAt: alert.occurredAt,
    tenantId: alert.tenantId,
    data: parseData(alert.data),
  }
}

export function opsAlertEmail(alert: ReceivedOpsAlert) {
  const label = alert.event === 'tenant.low_credit' ? 'Low tenant credit balance' : 'MCP upstream connectivity failure'
  return {
    subject: `[Maha operations] ${label}`,
    text: `${label.toUpperCase()}\n\nEvent: ${alert.event}\nEvent ID: ${alert.eventId}\nOccurred: ${alert.occurredAt}\nTenant: ${alert.tenantId}\n\nDetails:\n${JSON.stringify(alert.data, null, 2)}\n`,
  }
}
