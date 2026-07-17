import { createHmac } from 'node:crypto'

export const PUBLIC_MPS_AUDIT_DAILY_LIMIT = 3

export class PublicMpsAuditConfigurationError extends Error {
  constructor() {
    super('Public MPS audit rate limiting is not configured.')
    this.name = 'PublicMpsAuditConfigurationError'
  }
}

function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  return forwarded.split(',')[0]?.trim() || 'unknown'
}

export function publicAuditVisitorHash(request: Request): string {
  const secret = process.env.MPS_PUBLIC_AUDIT_RATE_LIMIT_SECRET
  if (!secret) throw new PublicMpsAuditConfigurationError()

  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  return `sha256:${createHmac('sha256', secret).update(`${requestIp(request)}\n${userAgent}`).digest('hex')}`
}
