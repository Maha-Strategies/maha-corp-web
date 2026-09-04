/**
 * Audit production dependencies, retrying only what is worth retrying.
 *
 * `npm audit` exits non-zero for two unrelated reasons: it found advisories, or
 * it could not reach the registry. Treating those the same is how a gate ends
 * up either blocking on an outage or, worse, being made to pass through one.
 * Three separate runs were blocked in a single day by registry 503s, with no
 * advisory involved.
 *
 * So the two are separated. A registry failure is retried with backoff. A real
 * advisory fails immediately and is never retried, because retrying it would
 * only wait for a vulnerability to go away on its own.
 *
 * If the registry stays down for every attempt, this still fails. The gate did
 * not run, and a gate that could not run has established nothing -- reporting
 * that as "no advisories" would be a lie the build tells itself. The failure
 * message says which of the two happened so nobody has to read the log to find
 * out.
 *
 *   node --experimental-strip-types scripts/audit-production-dependencies.ts
 */
import { spawnSync } from 'node:child_process'

const ATTEMPTS = Number(process.env.AUDIT_ATTEMPTS ?? 5)
const LEVELS = ['critical', 'high'] as const

type AuditJson = {
  error?: { code?: string; summary?: string; detail?: string }
  metadata?: { vulnerabilities?: Record<string, number> }
  vulnerabilities?: Record<string, { severity: string; via: unknown[]; fixAvailable?: unknown }>
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function runAudit(): { json: AuditJson | null; raw: string } {
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const raw = `${result.stdout ?? ''}${result.stderr ?? ''}`
  try {
    return { json: JSON.parse(result.stdout ?? '') as AuditJson, raw }
  } catch {
    return { json: null, raw }
  }
}

/**
 * Whether a failure is the registry rather than the dependency tree.
 *
 * Deliberately narrow: only failures that name the audit endpoint or a network
 * condition. Anything unrecognised is treated as real, so a new kind of genuine
 * failure is never retried into silence.
 */
function isRegistryFailure(json: AuditJson | null, raw: string): boolean {
  if (json?.error) return true
  return /audit endpoint returned an error|503 Service Unavailable|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(raw)
}

let lastRaw = ''
for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const { json, raw } = runAudit()
  lastRaw = raw

  if (json?.metadata?.vulnerabilities) {
    const counts = json.metadata.vulnerabilities
    const blocking = LEVELS.reduce((n, level) => n + (counts[level] ?? 0), 0)
    const summary = Object.entries(counts).filter(([, n]) => n > 0)
      .map(([level, n]) => `${n} ${level}`).join(', ') || 'none'

    if (blocking > 0) {
      console.error(`Production dependency advisories at or above high: ${summary}.`)
      for (const [name, v] of Object.entries(json.vulnerabilities ?? {})) {
        if (LEVELS.includes(v.severity as never)) console.error(`  ${name}: ${v.severity}`)
      }
      // Never retried. A vulnerability does not resolve by asking again.
      process.exit(1)
    }
    console.log(`Production dependency audit passed (${summary}); attempt ${attempt}.`)
    process.exit(0)
  }

  if (!isRegistryFailure(json, raw)) {
    console.error('npm audit failed for a reason that is not a registry outage. Not retrying.')
    console.error(raw.slice(0, 2000))
    process.exit(1)
  }

  if (attempt < ATTEMPTS) {
    const waitMs = 2000 * 2 ** (attempt - 1)
    console.warn(`Registry unavailable (attempt ${attempt} of ${ATTEMPTS}); retrying in ${waitMs / 1000}s.`)
    sleep(waitMs)
  }
}

console.error(`The dependency audit could not reach the registry in ${ATTEMPTS} attempts.`)
console.error('This is an infrastructure failure, not a clean audit. The gate did not run, so it has established nothing.')
console.error(lastRaw.slice(0, 1000))
process.exit(1)
