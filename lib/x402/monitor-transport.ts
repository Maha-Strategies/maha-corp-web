/** Stay below the current 60 requests / 300s / IP firewall rule.
 * Serialise starts and network work; never retry or attach payment credentials. */
export function createUnpaidMonitorFetch(options: {
  fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; intervalMs?: number
} = {}): typeof fetch {
  const interval = options.intervalMs ?? 6000
  if (!Number.isSafeInteger(interval) || interval < 6000) throw Error('unsafe_monitor_interval')
  const now = options.now ?? (() => performance.now())
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const fetcher = options.fetchImpl ?? fetch
  let next = 0, tail: Promise<unknown> = Promise.resolve()
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((v,k) => headers.set(k,v))
    if (['payment-signature','x-payment-signature','x-payment'].some(k => headers.has(k))) return Promise.reject(Error('monitor_payment_forbidden'))
    const run = tail.then(async () => {
      const wait = Math.max(0, next - now())
      if (wait) await sleep(wait)
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
      if (signal?.aborted) throw signal.reason ?? Error('monitor_request_aborted')
      next = now() + interval
      return fetcher(input, init)
    })
    tail = run.catch(() => {})
    return run
  }
}
