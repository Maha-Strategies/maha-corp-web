import { createHmac } from 'node:crypto'

// Free-tier rate limiting for self-serve micro-utilities. Mirrors the public
// MPS audit limiter: a salted HMAC of IP + user-agent is the only visitor
// identifier, and the daily count lives in public.public_utility_usage.

export const PUBLIC_UTILITY_DAILY_LIMIT = 3

export class PublicUtilityConfigurationError extends Error {
  constructor() {
    super('Public utility rate limiting is not configured.')
    this.name = 'PublicUtilityConfigurationError'
  }
}

function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  return forwarded.split(',')[0]?.trim() || 'unknown'
}

export function publicUtilityVisitorHash(request: Request): string {
  // Reuse the public-demo rate-limit secret so this works out of the box; a
  // dedicated PUBLIC_UTILITY_RATE_LIMIT_SECRET overrides it when set.
  const secret = process.env.PUBLIC_UTILITY_RATE_LIMIT_SECRET ?? process.env.MPS_PUBLIC_AUDIT_RATE_LIMIT_SECRET
  if (!secret) throw new PublicUtilityConfigurationError()
  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  return `sha256:${createHmac('sha256', secret).update(`${requestIp(request)}\n${userAgent}`).digest('hex')}`
}
