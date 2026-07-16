import { randomUUID } from 'node:crypto'

import type { MpsAuditResult } from './mps-audit-engine'

export const MPS_AUDIT_CAPABILITY = 'mps_audit' as const

export type MpsAuditJobRequest = {
  clientRequestId: string
  text: unknown
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function clientRequestId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('clientRequestId must be a string.')
  const trimmed = value.trim()
  if (trimmed.length < 8 || trimmed.length > 120 || /[\r\n]/.test(trimmed)) {
    throw new Error('clientRequestId must contain 8–120 characters on one line.')
  }
  return trimmed
}

export function parseMpsAuditJobRequest(value: unknown): MpsAuditJobRequest {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  return {
    clientRequestId: clientRequestId(body.clientRequestId),
    text: body.text,
  }
}

export function createMpsAuditJobId(): string {
  return `audit_${randomUUID().replaceAll('-', '')}`
}

export function validMpsAuditJobId(value: string): boolean {
  return /^audit_[a-f0-9]{32}$/.test(value)
}

export function serializableMpsAuditResult(value: MpsAuditResult): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}
