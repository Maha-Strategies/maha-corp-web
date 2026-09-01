/**
 * Waits for an ephemeral branch's REST API to actually serve.
 *
 * A Supabase branch reports its database connection details before PostgREST
 * begins answering on the branch hostname. Direct psql therefore succeeds -
 * migrations apply, the schema is real - while the very next HTTP call from the
 * deployment fails with no status and no error code, because nothing answered.
 * That is what run 33491367609 hit: the persistence client existed, the call
 * failed, and the SQLSTATE was absent because there was no PostgREST response
 * to carry one.
 *
 * "The database is up" and "the API is up" are separate facts, and only the
 * second licenses deploying. So this asks the branch directly, through the same
 * interface the application will use, against a table the Batch 11 migrations
 * created - which proves the route is live *and* that the schema cache has the
 * rehearsal objects in it.
 *
 * The asymmetry is deliberate. Only an expected success proves readiness;
 * connection failures, 404 while a route propagates, and 502/503/504 are
 * ordinary states on the way there and are retried. 401 and 403 are not: a
 * credential that is rejected now will be rejected in a minute, and retrying
 * turns a configuration defect into a timeout that hides it.
 *
 * Nothing here logs, returns or stores the credential, the branch hostname or
 * any response body. What comes back is a count per sanitized status class.
 */

export const REST_READINESS_VERSION = 'maha-batch-11-rest-readiness/1.0' as const

/** A table the Batch 11 migrations create. Readiness means *this* is visible. */
export const READINESS_RELATION = 'batch_11_rehearsal_imported_lineage' as const

export type ReadinessRefusal = 'unauthorized' | 'forbidden' | 'timed-out'

export interface ReadinessOutcome {
  version: typeof REST_READINESS_VERSION
  ready: boolean
  attempts: number
  refusal: ReadinessRefusal | null
  /** Counts per sanitized class. Never a URL, body or credential. */
  statusClasses: Readonly<Record<string, number>>
  detail: string
}

/** Statuses that mean "not yet", as opposed to "not ever". */
const TRANSIENT = new Set([404, 408, 425, 429, 500, 502, 503, 504])

export interface ReadinessOptions {
  branchApiUrl: string
  serviceRole: string
  /** Deterministic: no jitter, so a failure reproduces exactly. */
  delaysMs?: readonly number[]
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

/** Fixed schedule, ~90s total. Deterministic by construction. */
export const DEFAULT_DELAYS: readonly number[] = [
  1_000, 1_000, 2_000, 2_000, 3_000, 3_000, 3_000, 5_000, 5_000, 5_000,
  5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000,
]

export async function awaitRestReadiness(options: ReadinessOptions): Promise<ReadinessOutcome> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const classes: Record<string, number> = {}
  const count = (label: string) => { classes[label] = (classes[label] ?? 0) + 1 }

  const done = (ready: boolean, refusal: ReadinessRefusal | null, attempts: number, detail: string): ReadinessOutcome =>
    ({ version: REST_READINESS_VERSION, ready, attempts, refusal, statusClasses: { ...classes }, detail })

  // One more attempt than delays: the last attempt is not followed by a wait.
  for (let attempt = 1; attempt <= delays.length + 1; attempt += 1) {
    let status = 0
    let body: unknown = null
    try {
      const response = await doFetch(
        `${options.branchApiUrl}/rest/v1/${READINESS_RELATION}?select=record_id&limit=1`,
        {
          method: 'GET',
          // The credential travels here and nowhere else.
          headers: {
            apikey: options.serviceRole,
            authorization: `Bearer ${options.serviceRole}`,
            accept: 'application/json',
          },
          cache: 'no-store',
        },
      )
      status = response.status
      if (status === 200) {
        try { body = JSON.parse(await response.text()) } catch { body = null }
      }
    } catch {
      // No status at all - DNS, TLS or connection refused. The exact shape run
      // 33491367609 produced, and the ordinary state while a branch comes up.
      count('network')
      if (attempt > delays.length) break
      await sleep(delays[attempt - 1])
      continue
    }

    if (status === 401 || status === 403) {
      count(String(status))
      // Not propagation. Retrying would hide a credential defect behind a
      // timeout, and the answer would not change.
      return done(false, status === 401 ? 'unauthorized' : 'forbidden', attempt,
        `The branch REST API rejected the service-role credential with ${status}.`)
    }

    if (status === 200 && Array.isArray(body)) {
      count('200')
      return done(true, null, attempt,
        `The branch REST API served ${READINESS_RELATION} after ${attempt} attempt(s).`)
    }

    // A 200 that is not a PostgREST collection is something else answering on
    // the hostname - a gateway placeholder, an error page - and is not this
    // relation being readable.
    count(status === 200 ? '200-unexpected' : TRANSIENT.has(status) ? String(status) : `other-${status}`)
    if (attempt > delays.length) break
    await sleep(delays[attempt - 1])
  }

  return done(false, 'timed-out', delays.length + 1,
    `The branch REST API did not serve ${READINESS_RELATION} within ${delays.length + 1} attempts.`)
}
