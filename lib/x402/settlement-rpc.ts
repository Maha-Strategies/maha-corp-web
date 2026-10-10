/** Serialize and pace every RPC read, including block timestamps and head checks. */
export function settlementRpcQueue(intervalMs = 350, clock: {
  now(): number
  sleep(ms: number): Promise<void>
} = { now: Date.now, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 10000) throw new Error('invalid_rpc_pacing')
  let tail: Promise<unknown> = Promise.resolve()
  let nextStart = 0
  return function read<T>(request: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      const delay = nextStart - clock.now()
      if (delay > 0) await clock.sleep(delay)
      nextStart = clock.now() + intervalMs
      return request()
    })
    // A failed request must not poison subsequent reads or skip retry pacing.
    tail = result.catch(() => undefined)
    return result
  }
}

/** Only allowlisted diagnostics may reach logs; provider URLs can contain keys. */
export function settlementRefreshFailure(error: unknown): string {
  let current: unknown = error
  for (let depth = 0; depth < 6 && current instanceof Error; depth++) {
    const message = current.message
    if (/rate.?limit|request limit reached|too many requests|high consumption|quota|HTTP\s*429/i.test(message)) return 'rate_limited'
    if (/timeout|timed out/i.test(message)) return 'timeout'
    if (/rpc_configuration|rpc_chain_mismatch/i.test(message)) return 'configuration'
    if (/refresh_lock_expired|snapshot_changed|refresh_already_running/i.test(message)) return 'concurrent_refresh'
    if (/requires_offline_backfill|backfill_limit_exceeded/i.test(message)) return 'requires_backfill'
    if (/invalid_.*snapshot|conflicting_transfer|invalid_transfer|invalid_block_time|head_behind_snapshot/i.test(message)) return 'invalid_evidence'
    if (/range.*(?:limit|exceed|large|wide|not supported)|limit.*(?:block|range)|too many (?:results|logs)|response size|query returned more/i.test(message)) return 'range_limit'
    current = current.cause
  }
  return 'unavailable'
}

export function settlementRpcUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.BASE_RPC_URL?.trim()
  if (!configured && env.VERCEL_ENV === 'production') throw new Error('settlement_rpc_configuration_missing')
  const value = configured || 'https://mainnet.base.org'
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && !(env.VERCEL_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error()
    if (url.username || url.password) throw new Error()
  } catch { throw new Error('settlement_rpc_configuration_invalid') }
  return value
}
