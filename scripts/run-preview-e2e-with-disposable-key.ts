import nextEnv from '@next/env'
import { spawn } from 'node:child_process'

nextEnv.loadEnvConfig(process.cwd())

const baseUrl = process.env.TEST_API_URL?.trim().replace(/\/$/, '')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

if (!baseUrl?.startsWith('https://')) throw new Error('TEST_API_URL must be an HTTPS Preview deployment URL.')
const host = new URL(baseUrl).host
if (/mahastrategies\.com$/.test(host)) throw new Error(`Refusing to run against an apex or custom domain: ${host}`)

function protectedHeaders(extra: Record<string, string> = {}) {
  return {
    ...extra,
    ...(bypass ? {
      'x-vercel-protection-bypass': bypass,
      'x-vercel-set-bypass-cookie': 'false',
    } : {}),
  }
}

async function run(script: string, apiKey: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', script], {
      cwd: process.cwd(),
      env: { ...process.env, STAGING_API_KEY: apiKey },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${script} terminated by ${signal}.`))
      else resolve(code ?? 1)
    })
  })
}

/**
 * Provision one disposable tenant.
 *
 * Each gate gets its own. The two gates previously shared a single key, so the
 * integration gate spent the tenant's rate-limit budget and the attribution
 * gate's unattributed control call -- which asserts that an ordinary call
 * succeeds -- then received a 429 from the limiter rather than a success. The
 * assertion was right and the identity was wrong: the limiter is per tenant, so
 * two tenants give the second gate the fresh budget its assertion assumes.
 */
async function provision(label: string): Promise<string> {
  const generated = await fetch(`${baseUrl}/api/v1/keys/generate`, {
    method: 'POST',
    headers: protectedHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ email: `preview-canary+${label}-${Date.now()}@mahastrategies.com` }),
  })
  if (!generated.ok) {
    throw new Error(`Disposable Preview key provisioning failed for ${label} with HTTP ${generated.status}: ${(await generated.text()).slice(0, 300)}`)
  }
  const payload = await generated.json() as { apiKey?: string; balanceCredits?: number }
  if (!payload.apiKey) throw new Error(`Disposable Preview key response for ${label} did not contain a key.`)
  console.log(`Provisioned an isolated Preview canary tenant for ${label} with ${payload.balanceCredits ?? 'starter'} credits.`)
  return payload.apiKey
}

/** Revoke every tenant, reporting failures without masking a gate result. */
async function revokeAll(keys: { label: string; apiKey: string }[]): Promise<string[]> {
  const failures: string[] = []
  for (const { label, apiKey } of keys) {
    const revoked = await fetch(`${baseUrl}/api/v1/keys/revoke`, {
      method: 'POST',
      headers: protectedHeaders({ authorization: `Bearer ${apiKey}` }),
    })
    if (!revoked.ok) failures.push(`${label} (HTTP ${revoked.status})`)
    else console.log(`Revoked the disposable Preview canary key for ${label}.`)
  }
  return failures
}

const provisioned: { label: string; apiKey: string }[] = []
let e2eStatus = 1
let attributionStatus = 1
let revocationFailures: string[] = []

try {
  const integrationKey = await provision('integration')
  provisioned.push({ label: 'integration', apiKey: integrationKey })
  e2eStatus = await run('scripts/test-e2e.ts', integrationKey)

  // Attribution proves a different write/read path and must still run when an
  // upstream integration gate fails. A failed product test must not suppress
  // the database evidence needed to diagnose an unrelated billing regression.
  const attributionKey = await provision('attribution')
  provisioned.push({ label: 'attribution', apiKey: attributionKey })
  attributionStatus = await run('scripts/probe-preview-attribution.ts', attributionKey)
} finally {
  revocationFailures = await revokeAll(provisioned)
}

if (e2eStatus !== 0 || attributionStatus !== 0) {
  throw new Error(`Preview gates failed (integration=${e2eStatus}, attribution=${attributionStatus}).`)
}
// Reported after the gate result so a cleanup problem cannot be mistaken for a
// product failure, and cannot hide one either.
if (revocationFailures.length > 0) {
  throw new Error(`Disposable Preview key revocation failed for: ${revocationFailures.join(', ')}.`)
}
