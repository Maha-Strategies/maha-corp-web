export const RECOVERY_HEALTH_STATES = ['unknown', 'contradicted', 'marker_failed', 'stale_pending', 'legacy_reserved'] as const
export type RecoveryHealthState = typeof RECOVERY_HEALTH_STATES[number]
export type RecoveryHealth = { state: 'ok' | 'warn' | 'fail'; counts: Record<RecoveryHealthState, number> }

/** Aggregate counts only; no payer, content, signature or idempotency-key disclosure. */
export function recoveryHealthFromRows(value: unknown): RecoveryHealth | null {
  if (!Array.isArray(value)) return null
  const counts = Object.fromEntries(RECOVERY_HEALTH_STATES.map((state) => [state, 0])) as RecoveryHealth['counts']
  const seen = new Set<string>()
  for (const row of value) {
    if (!row || typeof row !== 'object' || !RECOVERY_HEALTH_STATES.includes(row.state) || seen.has(row.state)) return null
    const count = typeof row.count === 'number' || typeof row.count === 'string' && /^\d+$/.test(row.count) ? Number(row.count) : NaN
    if (!Number.isSafeInteger(count) || count < 0) return null
    counts[row.state as RecoveryHealthState] = count
    seen.add(row.state)
  }
  if (seen.size !== RECOVERY_HEALTH_STATES.length) return null
  return { counts, state: counts.unknown || counts.contradicted ? 'fail' : counts.marker_failed || counts.stale_pending || counts.legacy_reserved ? 'warn' : 'ok' }
}
