/**
 * Obtains the branch's own service key from the provider.
 *
 * The rehearsal used to mint an HS256 token from the branch JWT secret with
 * self-hosted claims. Run 33494192235 proved the branch does not accept it: the
 * REST readiness probe was answered with 401 on its first attempt. A hosted
 * project's keys are issued by the provider and carry claims - and, for newer
 * key types, a form - that nothing outside the provider can reproduce.
 *
 * So the key is asked for rather than constructed. That removes a whole class
 * of failure: there is no claim set to get wrong, no signing algorithm to
 * guess, and no silent divergence when the provider changes how keys are
 * issued.
 *
 * Selection is deliberately unforgiving. Exactly one unambiguous secret key
 * must be present and revealed; no key, several, a masked one, a
 * publishable-shaped one, or a response that does not parse are all refusals
 * rather than a best guess, because the cost of guessing here is a credential
 * that authenticates as something other than intended.
 *
 * The value never leaves this module except through the caller's own variable.
 * The outcome - the part that is safe to serialize, log or place in evidence -
 * is a separate object that never contains it, and describes the selected key
 * only by type and name.
 */

export const BRANCH_API_KEY_VERSION = 'maha-batch-11-branch-api-key/1.0' as const

export type BranchKeyRefusal =
  | 'unauthorized'
  | 'forbidden'
  | 'timed-out'
  | 'response-malformed'
  | 'no-secret-key'
  | 'ambiguous-secret-key'
  | 'key-masked'
  | 'key-publishable-shaped'

/** Everything about the acquisition that is safe to publish. Never the key. */
export interface BranchKeyOutcome {
  version: typeof BRANCH_API_KEY_VERSION
  acquired: boolean
  attempts: number
  refusal: BranchKeyRefusal | null
  statusClasses: Readonly<Record<string, number>>
  /** How the selected key identifies itself. Never its value. */
  selected: { type: string; name: string } | null
  /**
   * What the branch offered, by type and name only.
   *
   * Present on refusals so an ambiguous or empty listing can be diagnosed from
   * the artifact instead of costing another protected run.
   */
  candidates: readonly { type: string; name: string }[]
  detail: string
}

/** Statuses that mean "not yet". Provider-issued keys can lag branch creation. */
const TRANSIENT = new Set([404, 408, 425, 429, 500, 502, 503, 504])

/** Fixed schedule, no jitter, so a failure reproduces exactly. */
export const DEFAULT_KEY_DELAYS: readonly number[] = [
  1_000, 1_000, 2_000, 2_000, 3_000, 3_000, 3_000, 5_000, 5_000, 5_000, 5_000, 5_000,
]

interface ApiKeyRow {
  api_key?: string | null
  type?: string | null
  name?: string
  prefix?: string | null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Type and name only. Never a value, prefix or hash. */
const describe = (rows: readonly ApiKeyRow[]) =>
  rows.map((row) => ({ type: String(row.type ?? 'unknown'), name: String(row.name ?? 'unnamed') }))

/**
 * Whether a returned value is a usable secret, without ever revealing it.
 *
 * Masking is what the provider does when `reveal` was not honoured, and the
 * masked form still looks like a string, so an unrevealed key would otherwise
 * be handed to PostgREST and rejected far from here.
 */
function keyProblem(value: unknown): 'key-masked' | 'key-publishable-shaped' | null {
  if (typeof value !== 'string' || value.trim().length < 20) return 'key-masked'
  const key = value.trim()
  if (key.includes('*') || key.includes('…') || key.includes('...')) return 'key-masked'
  // A publishable or anonymous key authenticates as the wrong thing entirely.
  if (/^sb_publishable_/.test(key)) return 'key-publishable-shaped'
  return null
}

/**
 * Which tier a row belongs to, or null if it is not a secret-class key.
 *
 * A hosted project can publish both at once, and run 33497894169 did: a modern
 * `secret` key and a legacy key named `service_role`. Those are not rival
 * identities to choose between - they are the same authority in two forms, and
 * the modern one is what the provider issues going forward.
 *
 * So the tiers are ranked rather than pooled. Ambiguity still refuses, but it
 * now means what it should: two keys of the *same* tier, where picking one
 * really would be picking which identity the rehearsal runs as.
 */
function secretTier(row: ApiKeyRow): 'secret' | 'legacy-service-role' | null {
  if (row.type === 'secret') return 'secret'
  if (row.type === 'legacy' && row.name === 'service_role') return 'legacy-service-role'
  return null
}

export interface BranchKeyOptions {
  branchRef: string
  /** Called with the path; returns the raw provider response. */
  request: (path: string) => Promise<{ status: number; body: unknown }>
  delaysMs?: readonly number[]
  sleep?: (ms: number) => Promise<void>
}

/**
 * Returns the safe outcome and, separately, the key.
 *
 * Two values on purpose: the outcome is what gets serialized into evidence and
 * error messages, and it is structurally incapable of carrying the secret.
 */
export async function acquireBranchServiceKey(
  options: BranchKeyOptions,
): Promise<{ outcome: BranchKeyOutcome; key: string | null }> {
  const delays = options.delaysMs ?? DEFAULT_KEY_DELAYS
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const classes: Record<string, number> = {}
  const count = (label: string) => { classes[label] = (classes[label] ?? 0) + 1 }

  const refuse = (
    refusal: BranchKeyRefusal,
    attempts: number,
    detail: string,
    candidates: readonly { type: string; name: string }[] = [],
  ) => ({
    outcome: {
      version: BRANCH_API_KEY_VERSION, acquired: false, attempts, refusal,
      statusClasses: { ...classes }, selected: null, candidates, detail,
    } satisfies BranchKeyOutcome,
    key: null,
  })

  for (let attempt = 1; attempt <= delays.length + 1; attempt += 1) {
    let status = 0
    let body: unknown = null
    try {
      const response = await options.request(`/v1/projects/${options.branchRef}/api-keys?reveal=true`)
      status = response.status
      body = response.body
    } catch {
      count('network')
      if (attempt > delays.length) break
      await sleep(delays[attempt - 1])
      continue
    }

    if (status === 401 || status === 403) {
      count(String(status))
      // A scope defect, not propagation. The answer will not change, and
      // retrying would bury it in a timeout.
      return refuse(status === 401 ? 'unauthorized' : 'forbidden', attempt,
        `The Management API refused branch-scoped key retrieval with ${status}.`)
    }

    if (status !== 200) {
      count(TRANSIENT.has(status) ? String(status) : `other-${status}`)
      if (attempt > delays.length) break
      await sleep(delays[attempt - 1])
      continue
    }

    count('200')
    if (!Array.isArray(body)) {
      return refuse('response-malformed', attempt, 'The key listing was not an array.')
    }

    const rows = body.filter(isObject) as ApiKeyRow[]
    if (rows.length !== body.length) {
      return refuse('response-malformed', attempt, 'The key listing contained a non-object entry.')
    }

    // Modern keys win when present; legacy is the fallback for older projects.
    const modern = rows.filter((row) => secretTier(row) === 'secret')
    const legacy = rows.filter((row) => secretTier(row) === 'legacy-service-role')
    const secrets = modern.length > 0 ? modern : legacy
    if (secrets.length === 0) {
      // The branch may not have published its keys yet; that is a wait, not a
      // verdict, until the schedule is exhausted.
      if (attempt > delays.length) {
        return refuse('no-secret-key', attempt, 'The branch published no secret or service-role key.', describe(rows))
      }
      count('awaiting-key')
      await sleep(delays[attempt - 1])
      continue
    }
    if (secrets.length > 1) {
      // Two of the same tier. Choosing would be choosing which identity the
      // rehearsal runs as, which is not a decision this may make silently.
      return refuse('ambiguous-secret-key', attempt,
        `The branch published ${secrets.length} keys of the same tier; exactly one is required.`,
        describe(rows))
    }

    const selected = secrets[0]
    const problem = keyProblem(selected.api_key)
    if (problem) {
      return refuse(problem, attempt, problem === 'key-masked'
        ? 'The branch key was returned masked or unrevealed.'
        : 'The branch key has the shape of a publishable key.', describe(rows))
    }

    return {
      outcome: {
        version: BRANCH_API_KEY_VERSION,
        acquired: true,
        attempts: attempt,
        refusal: null,
        statusClasses: { ...classes },
        // Type and name only. Never the value, never the prefix.
        selected: { type: String(selected.type ?? 'unknown'), name: String(selected.name ?? 'unnamed') },
        candidates: describe(rows),
        detail: `The provider issued one secret key for the branch after ${attempt} attempt(s).`,
      },
      key: String(selected.api_key).trim(),
    }
  }

  return refuse('timed-out', delays.length + 1,
    `The branch did not publish a usable secret key within ${delays.length + 1} attempts.`)
}
