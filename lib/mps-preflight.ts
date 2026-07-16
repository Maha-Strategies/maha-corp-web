import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

import type { MpsAuditClaim, MpsAuditResult } from './mps-audit-engine'

export const PREFLIGHT_PRICE_USD = 49
export const PREFLIGHT_MAX_CHARS = 12_000
export const PREFLIGHT_MAX_CHUNKS = 2
export const PREFLIGHT_MODEL = 'claude-sonnet-4-6'
export const SITE_URL = 'https://www.mahastrategies.com'

export type PreflightStatus = 'awaiting_payment' | 'paid' | 'processing' | 'completed' | 'failed'
export type DeliveryStatus = 'pending' | 'sent' | 'not_configured' | 'failed'

export type StoredPreflight = {
  public_id: string
  access_hash: string
  customer_email: string
  document_label: string | null
  status: PreflightStatus
  stripe_checkout_session_id: string | null
  input_hash: string | null
  report: MpsAuditResult | null
  failure_code: string | null
  delivery_status: DeliveryStatus
  created_at: string
  completed_at: string | null
}

export function createPreflightId(): string {
  return `preflight_${randomUUID().replaceAll('-', '')}`
}

export function validPreflightId(value: string): boolean {
  return /^preflight_[a-f0-9]{32}$/.test(value)
}

export function createAccessSecret(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSecret(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function secretMatches(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(value))
  const expected = Buffer.from(expectedHash)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function parseCustomerEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Email is required.')
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  return email
}

export function parseDocumentLabel(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error('Document label must be text.')
  const label = value.trim()
  if (label.length > 120 || /[\r\n]/.test(label)) throw new Error('Document label must be 120 characters or fewer on one line.')
  return label || null
}

export function parsePreflightText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Paste the document text to begin the preflight.')
  const text = value.trim()
  if (text.length > PREFLIGHT_MAX_CHARS) {
    throw new Error(`This preflight accepts up to ${PREFLIGHT_MAX_CHARS.toLocaleString()} characters (about 2,000 words).`)
  }
  return text
}

export function splitPreflightText(text: string): string[] {
  if (text.length <= 6_000) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length && chunks.length < PREFLIGHT_MAX_CHUNKS) {
    if (remaining.length <= 6_000) {
      chunks.push(remaining)
      break
    }
    const window = remaining.slice(0, 6_000)
    const breakAt = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(', '))
    const end = breakAt > 3_000 ? breakAt + 1 : 6_000
    chunks.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trim()
  }
  if (remaining) throw new Error('This preflight is too long. Use a smaller extract or request a human evidence audit.')
  return chunks
}

export function mergePreflightAudits(fullText: string, audits: MpsAuditResult[]): MpsAuditResult {
  const claims: MpsAuditClaim[] = []
  const seen = new Set<string>()
  for (const audit of audits) {
    for (const claim of audit.claims) {
      if (!seen.has(claim.excerpt)) {
        seen.add(claim.excerpt)
        claims.push(claim)
      }
    }
  }
  return {
    mps_version: '0.1',
    input_hash: `sha256:${createHash('sha256').update(fullText).digest('hex')}`,
    claims,
  }
}

export function reportPath(orderId: string, access: string): string {
  return `${SITE_URL}/mps/preflight/report?orderId=${encodeURIComponent(orderId)}&access=${encodeURIComponent(access)}`
}
