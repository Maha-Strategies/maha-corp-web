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

const generated = await fetch(`${baseUrl}/api/v1/keys/generate`, {
  method: 'POST',
  headers: protectedHeaders({ 'content-type': 'application/json' }),
  body: JSON.stringify({ email: `preview-canary+${Date.now()}@mahastrategies.com` }),
})
if (!generated.ok) {
  throw new Error(`Disposable Preview key provisioning failed with HTTP ${generated.status}: ${(await generated.text()).slice(0, 300)}`)
}
const payload = await generated.json() as { apiKey?: string; balanceCredits?: number }
if (!payload.apiKey) throw new Error('Disposable Preview key response did not contain a key.')
console.log(`Provisioned an isolated Preview canary tenant with ${payload.balanceCredits ?? 'starter'} credits.`)

let e2eStatus = 1
let attributionStatus = 1
try {
  e2eStatus = await run('scripts/test-e2e.ts', payload.apiKey)
  // Attribution proves a different write/read path and must still run when an
  // upstream integration gate fails. A failed product test must not suppress
  // the database evidence needed to diagnose an unrelated billing regression.
  attributionStatus = await run('scripts/probe-preview-attribution.ts', payload.apiKey)
} finally {
  const revoked = await fetch(`${baseUrl}/api/v1/keys/revoke`, {
    method: 'POST',
    headers: protectedHeaders({ authorization: `Bearer ${payload.apiKey}` }),
  })
  if (!revoked.ok) throw new Error(`Disposable Preview key revocation failed with HTTP ${revoked.status}.`)
  console.log('Revoked the disposable Preview canary key.')
}

if (e2eStatus !== 0 || attributionStatus !== 0) {
  throw new Error(`Preview gates failed (integration=${e2eStatus}, attribution=${attributionStatus}).`)
}
