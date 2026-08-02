import { timingSafeEqual } from 'node:crypto'

import { authorizeRevenueOperations } from './revenue-control-plane.ts'

export type ReadinessAuthorization = { kind: 'authorized' } | { kind: 'unauthorized' } | { kind: 'unconfigured' }

function releaseTokenMatches(request: Request, token: string) {
  if (Buffer.byteLength(token, 'utf8') < 32 || Buffer.byteLength(token, 'utf8') > 4_096) return false
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(token)
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
}

export function authorizeReadiness(request: Request): ReadinessAuthorization {
  const releaseToken = process.env.RELEASE_HEALTH_TOKEN?.trim()
  if (releaseToken && releaseTokenMatches(request, releaseToken)) return { kind: 'authorized' }
  const revenueAuthorization = authorizeRevenueOperations(request)
  if (revenueAuthorization.kind === 'authorized') return { kind: 'authorized' }
  if (!releaseToken && revenueAuthorization.kind === 'unconfigured') return { kind: 'unconfigured' }
  return { kind: 'unauthorized' }
}
