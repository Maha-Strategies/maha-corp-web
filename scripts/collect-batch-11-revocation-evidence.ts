import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { fingerprintCredential } from '../lib/batch-11-credential-provenance.ts'
import {
  TEMPORARY_REVOCABLE_SECRET_NAMES,
  environmentSecretSlotFingerprint,
  runMarkerFor,
} from '../lib/batch-11-evidence-binding.ts'
import {
  REVOCABLE_CREDENTIALS,
  assertRevocationInputSanitized,
  produceRevocationEvidence,
  type CheckScope,
  type CheckStatus,
  type RevocableCredential,
  type RevocationCheck,
} from '../lib/batch-11-revocation-evidence.ts'

/**
 * Asks each provider whether a temporary credential still resolves.
 *
 * Revocation is the fact that outlives the run. A branch can be destroyed while
 * the token that created it stays valid, and nothing in the rehearsal's own
 * evidence would reveal that - which is why this is a separate collection,
 * performed after teardown, by whoever holds the credentials.
 *
 * Every check is wrapped so a thrown error, an unreadable response or an
 * unsupplied credential becomes `failed` or `not-attempted`, never a claim of
 * revocation. The asymmetry is the same one teardown uses: a provider saying
 * "this no longer resolves" is evidence; silence is not.
 *
 * Credentials are read from the environment, travel only in request headers,
 * and are recorded only as fingerprints of the values themselves - so an
 * observation names the exact secret it tested, and cannot be satisfied by some
 * other genuinely-revoked token. Nothing here writes, revokes or deletes
 * anything; it observes what revocation already happened.
 *
 * Usage:
 *   MAHA_B11_RUN_ID=<numeric run id> \
 *   MAHA_B11_REVIEWED_COMMIT=<40-char sha> \
 *   [SUPABASE_ACCESS_TOKEN=...] \
 *   [VERCEL_TOKEN=... VERCEL_PROJECT_ID=... VERCEL_AUTOMATION_BYPASS_SECRET=...] \
 *   [GITHUB_TOKEN=...] \
 *   node --experimental-strip-types scripts/collect-batch-11-revocation-evidence.ts --out <path>
 *
 * Supply the revoked credential you are testing. Its absence yields
 * `not-attempted`, which does not close. The Vercel probe needs the revoked
 * bypass value itself, because the question is whether that exact key is gone -
 * not whether the project has any bypasses at all.
 */

const flag = (name: string, fallback: string | null = null): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const runId = process.env.MAHA_B11_RUN_ID?.trim() ?? ''
const reviewedCommit = process.env.MAHA_B11_REVIEWED_COMMIT?.trim() ?? ''
const outPath = flag('out', 'batch-11-teardown/revocation.json')!

if (!/^[0-9]{1,20}$/.test(runId)) {
  console.error('MAHA_B11_RUN_ID must be the numeric workflow run id.')
  process.exit(2)
}
if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) {
  console.error('MAHA_B11_REVIEWED_COMMIT must be a 40-character lowercase SHA.')
  process.exit(2)
}
const runMarker = runMarkerFor(runId)


interface Outcome {
  status: CheckStatus
  scope: CheckScope
  stillResolves: boolean
  detail: string
}

/**
 * Runs one revocation probe.
 *
 * `stillResolves` is only ever set from a definite provider answer. Anything
 * ambiguous resolves to a non-succeeded status instead, so an unreadable
 * response cannot be mistaken for revocation.
 */
async function probe(
  describe: string,
  scope: CheckScope,
  run: () => Promise<Outcome>,
): Promise<Outcome> {
  try {
    return await run()
  } catch (error) {
    return { status: 'failed', scope, stillResolves: false, detail: `${describe} raised ${(error as Error).name}.` }
  }
}

const notAttempted = (detail: string): Outcome =>
  ({ status: 'not-attempted', scope: 'unknown', stillResolves: false, detail })

/**
 * Where to send each probe, overridable only to loopback.
 *
 * The probes carry live credentials, so an override that could name any host
 * would be a way to exfiltrate one by setting an environment variable. Only
 * http://127.0.0.1 is accepted, and anything else exits rather than falling
 * back to the real endpoint - a misconfigured override must not silently
 * become a production call either.
 */
const endpoint = (name: string, production: string): string => {
  const override = process.env[name]?.trim()
  if (!override) return production
  let url: URL
  try {
    url = new URL(override)
  } catch {
    console.error(`${name} is not a URL.`)
    process.exit(2)
  }
  if (url.protocol !== 'http:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
    console.error(`${name} may only point at http://127.0.0.1; refusing to send a credential elsewhere.`)
    process.exit(2)
  }
  return override.replace(/\/+$/, '')
}

const SUPABASE_API = endpoint('MAHA_B11_SUPABASE_API', 'https://api.supabase.com')
const VERCEL_API = endpoint('MAHA_B11_VERCEL_API', 'https://api.vercel.com')
const GITHUB_API = endpoint('MAHA_B11_GITHUB_API', 'https://api.github.com')

const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ''
const vercelToken = process.env.VERCEL_TOKEN?.trim() ?? ''
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? ''
const vercelProjectId = process.env.VERCEL_PROJECT_ID?.trim() ?? ''
const githubToken = process.env.GITHUB_TOKEN?.trim() ?? ''
const repository = process.env.GITHUB_REPOSITORY?.trim() ?? 'Maha-Strategies/maha-corp-web'
const environment = 'batch-11-preview-rehearsal'

const outcomes: Record<RevocableCredential, Outcome> = {
  /*
   * A revoked personal access token stops authenticating, and only 401 says so.
   *
   * The Management API documents 200, 401 "Unauthorized", 403 "Forbidden
   * action" and 429 for GET /v1/projects. 401 and 403 are separate documented
   * outcomes, and 403 is the one a *valid* fine-grained token receives when it
   * authenticates fine but is not permitted the action. Reading 403 as
   * revocation would let a live, working token close the run.
   *
   * There is no token-introspection endpoint to use instead: the spec's only
   * token paths are the OAuth app flows, and /v1/oauth/revoke is a POST that
   * revokes rather than reports. Nothing here may mutate, so the read stands.
   */
  'supabase-access-token': supabaseToken
    ? await probe('The Supabase token probe', 'exact-credential-fingerprint', async () => {
      const response = await fetch(`${SUPABASE_API}/v1/projects`, {
        headers: { authorization: `Bearer ${supabaseToken}` }, cache: 'no-store',
      })
      if (response.status === 401) {
        return { status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: false,
          detail: 'Supabase rejected the token with 401; it no longer authenticates.' }
      }
      if (response.ok) {
        return { status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: true,
          detail: `Supabase still accepts the token (${response.status}); it has not been revoked.` }
      }
      // 403, 404, 429 and every 5xx land here: authenticated-but-forbidden,
      // wrong resource, throttled or broken. None of them is revocation.
      return { status: 'failed', scope: 'exact-credential-fingerprint', stillResolves: false,
        detail: `Supabase answered ${response.status}, which neither confirms nor denies revocation.` }
    })
    : notAttempted('The Supabase token was not supplied, so its revocation cannot be confirmed.'),

  /*
   * Whether *this* bypass key is gone, not whether the project has bypasses.
   *
   * `protectionBypass` is a map whose keys are the bypass secrets themselves,
   * and the API documents multiple coexisting entries - one of which is the
   * default env var. This project legitimately carries unrelated bypasses, so a
   * non-empty map says nothing, and an empty one would "confirm" the revocation
   * of a bypass that was never there. The only question with an answer is
   * whether the exact key remains.
   *
   * Keys are compared as fingerprints so no bypass value - ours or anyone
   * else's - is ever held in a variable that could reach the output.
   */
  'vercel-automation-bypass': vercelToken && vercelProjectId && bypassSecret
    ? await probe('The Vercel protection-bypass probe', 'exact-credential-fingerprint', async () => {
      const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
      const response = await fetch(`${VERCEL_API}/v9/projects/${vercelProjectId}${team}`, {
        headers: { authorization: `Bearer ${vercelToken}` }, cache: 'no-store',
      })
      if (!response.ok) {
        return { status: 'failed', scope: 'exact-credential-fingerprint', stillResolves: false,
          detail: `Vercel answered ${response.status}; the protection settings could not be read.` }
      }
      const body = await response.json() as Record<string, unknown>
      const protection = body.protectionBypass
      if (protection !== null && protection !== undefined && typeof protection !== 'object') {
        return { status: 'malformed', scope: 'exact-credential-fingerprint', stillResolves: false,
          detail: 'Vercel returned a protectionBypass field that is not a map; the exact key cannot be located.' }
      }
      const wanted = fingerprintCredential(bypassSecret)
      const present = Object.keys((protection ?? {}) as Record<string, unknown>)
        .map((key) => fingerprintCredential(key))
      const survives = present.includes(wanted)
      // Other bypasses may remain. They are not this run's, and their presence
      // is not a finding.
      return { status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: survives,
        detail: survives
          ? `This run's automation bypass is still configured on the project (${present.length} bypass entr(ies) total).`
          : `This run's automation bypass is absent; ${present.length} unrelated bypass entr(ies) remain, which is expected.` }
    })
    : notAttempted('VERCEL_TOKEN, VERCEL_PROJECT_ID and the revoked VERCEL_AUTOMATION_BYPASS_SECRET were not all supplied, so bypass revocation cannot be confirmed.'),

  // Deleted environment secrets stop being listed. Names only are read.
  'github-environment-secrets': githubToken
    ? await probe('The protected-environment secret listing', 'exact-environment', async () => {
      const response = await fetch(`${GITHUB_API}/repos/${repository}/environments/${environment}/secrets`, {
        headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json' }, cache: 'no-store',
      })
      if (!response.ok) {
        return { status: 'failed', scope: 'exact-environment', stillResolves: false,
          detail: `GitHub answered ${response.status}; the environment secrets could not be listed.` }
      }
      const body = await response.json() as { secrets?: { name: string }[] }
      const present = (body.secrets ?? []).map((entry) => entry.name)
      const surviving = TEMPORARY_REVOCABLE_SECRET_NAMES.filter((name) => present.includes(name))
      return { status: 'succeeded', scope: 'exact-environment', stillResolves: surviving.length > 0,
        detail: surviving.length > 0
          ? `${surviving.length} temporary secret name(s) are still bound to ${environment}.`
          : `No temporary secret name remains bound to ${environment}.` }
    })
    : notAttempted('No GitHub credential was supplied, so secret deletion cannot be confirmed.'),
}

/**
 * The exact identity each observation is about.
 *
 * Two are fingerprints of the values themselves, which is what makes the
 * evidence specific: the closure verifier holds the same fingerprints from the
 * run artifact, so an observation about a different - even genuinely revoked -
 * token will not match. The third has no value to fingerprint, because GitHub
 * does not return secrets; the slot is bound instead, by the same function the
 * verifier uses, so the two cannot drift apart.
 *
 * When a credential was not supplied there is nothing to identify. The
 * fingerprint is left null and the check is already `not-attempted`, so the
 * absence stays an absence rather than becoming a plausible-looking hash.
 */
const identityFor = (credential: RevocableCredential): string | null => {
  if (credential === 'supabase-access-token') {
    return supabaseToken ? fingerprintCredential(supabaseToken) : null
  }
  if (credential === 'vercel-automation-bypass') {
    return bypassSecret ? fingerprintCredential(bypassSecret) : null
  }
  return environmentSecretSlotFingerprint({
    environment,
    names: TEMPORARY_REVOCABLE_SECRET_NAMES,
    runMarker,
    reviewedCommit,
  })
}

const UNIDENTIFIED = `sha256:${'0'.repeat(64)}`

const checks: RevocationCheck[] = REVOCABLE_CREDENTIALS.map((credential) => {
  const outcome = outcomes[credential]
  return {
    provider: credential.split('-')[0],
    credential,
    checkStatus: outcome.status,
    scope: outcome.scope,
    runMarker,
    reviewedCommit,
    credentialFingerprint: identityFor(credential) ?? UNIDENTIFIED,
    stillResolves: outcome.stillResolves,
    selfReportedOnly: false,
    detail: outcome.detail,
  }
})

const report = produceRevocationEvidence({ runMarker, reviewedCommit, checks })
const payload = { ...report, workflowRunId: runId, checks }

assertRevocationInputSanitized(payload)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)

process.stdout.write(`${JSON.stringify({
  runMarker,
  allConfirmedRevoked: report.allConfirmedRevoked,
  states: report.observations.map((entry) => ({ credential: entry.credential, observedState: entry.observedState, refusal: entry.refusal })),
}, null, 2)}\n`)

// A green exit must not be readable as confirmed revocation.
if (!report.allConfirmedRevoked) process.exit(1)
