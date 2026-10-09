import { createHash, timingSafeEqual } from 'node:crypto'

export const STORE_REVIEW_EMAIL = 'store-review@mahastrategies.com'
export const STORE_REVIEW_USER_ID = `astro_email_${createHash('sha256').update(STORE_REVIEW_EMAIL).digest('hex')}`
export function storeReviewConfig(now = Date.now()) {
  const digest = process.env.ASTROLOGY_STORE_REVIEW_TOKEN_SHA256?.trim() ?? ''
  // Explicit revocable mode keeps the reusable credential active; sessions still expire.
  const duration = process.env.ASTROLOGY_STORE_REVIEW_EXPIRES_AT?.trim()
  const expiresAt = duration === 'revocable' ? Infinity : Date.parse(duration ?? '')
  return /^[a-f0-9]{64}$/.test(digest) && expiresAt > now ? { digest, expiresAt } : null
}
export function validStoreReviewCredential(credential: string, now = Date.now()) {
  const config = storeReviewConfig(now)
  return Boolean(config && /^[a-f0-9]{64}$/.test(credential) && timingSafeEqual(Buffer.from(config.digest, 'hex'), createHash('sha256').update(credential).digest()))
}
export function isStoreReviewer(userId: string) { return userId === STORE_REVIEW_USER_ID && Boolean(storeReviewConfig()) }
// Only the published fictional example may enter this isolated review vault.
export function isReviewExample(raw: unknown) {
  if (!raw || typeof raw !== 'object') return false
  const chart = raw as Record<string, unknown>
  return ['1990-06-15T05:00:00.000Z', '1990-06-15T05:00:00Z'].includes(String(chart.instantUtc)) && chart.latitudeDegrees === 6.9271 && chart.longitudeDegrees === 79.8612 && chart.uncertaintyMinutes === 0
}

export function storeReviewPassExpiresAt() {
  const config = storeReviewConfig()
  return config && Number.isFinite(config.expiresAt) ? new Date(config.expiresAt).toISOString() : undefined
}
