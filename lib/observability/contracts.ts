import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

export type OpsAlertEnvironment = {
  MAHA_OPS_WEBHOOK_URL?: string
  MAHA_OPS_WEBHOOK_SECRET?: string
  MAHA_LOW_CREDIT_ALERT_THRESHOLD?: string
}

export type OpsAlertConfig = { url: string; secret: string; lowCreditThreshold: number }

function clean(value: string | undefined) { return value?.trim().replace(/^['"]|['"]$/g, '') || undefined }

export function opsAlertConfig(environment: OpsAlertEnvironment = process.env as OpsAlertEnvironment): OpsAlertConfig | null {
  const rawUrl = clean(environment.MAHA_OPS_WEBHOOK_URL)
  const secret = clean(environment.MAHA_OPS_WEBHOOK_SECRET)
  const rawThreshold = clean(environment.MAHA_LOW_CREDIT_ALERT_THRESHOLD)
  if (!rawUrl && !secret && !rawThreshold) return null
  if (!rawUrl || !secret) throw new Error('MAHA_OPS_WEBHOOK_URL and MAHA_OPS_WEBHOOK_SECRET must be configured together.')
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('MAHA_OPS_WEBHOOK_URL must be a public HTTPS URL.') }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || isIP(hostname)) throw new Error('MAHA_OPS_WEBHOOK_URL must be a public HTTPS URL without embedded credentials.')
  if (Buffer.byteLength(secret, 'utf8') < 32 || Buffer.byteLength(secret, 'utf8') > 4_096) throw new Error('MAHA_OPS_WEBHOOK_SECRET must contain 32-4096 UTF-8 bytes.')
  const lowCreditThreshold = rawThreshold === undefined ? 1_000 : Number(rawThreshold)
  if (!Number.isInteger(lowCreditThreshold) || lowCreditThreshold < 1 || lowCreditThreshold > 1_000_000) throw new Error('MAHA_LOW_CREDIT_ALERT_THRESHOLD must be an integer between 1 and 1000000.')
  return { url: url.toString(), secret, lowCreditThreshold }
}

export function signOpsAlert(body: string, secret: string) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

export function lowCreditAlertRequired(balance: number, threshold: number) {
  return Number.isInteger(balance) && balance >= 0 && balance < threshold
}
