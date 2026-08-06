import nextEnv from '@next/env'

import { MahaClient } from '../lib/sdk/index.ts'
import { runRestoredEngineE2e } from './test-restored-engines-e2e.ts'

nextEnv.loadEnvConfig(process.cwd())
const baseUrl = process.env.TEST_API_URL
if (!baseUrl?.startsWith('https://') || baseUrl.includes('mahastrategies.com')) throw new Error('TEST_API_URL must be an immutable Vercel Preview URL.')
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

const headers = new Headers({ 'Content-Type': 'application/json' })
if (bypass) headers.set('x-vercel-protection-bypass', bypass)
const generated = await fetch(`${baseUrl}/api/v1/keys/generate`, {
  method: 'POST', headers,
  body: JSON.stringify({ email: `preview-canary+${Date.now()}@mahastrategies.com` }),
})
if (!generated.ok) throw new Error(`Disposable Preview key provisioning failed with HTTP ${generated.status}.`)
const payload = await generated.json() as { apiKey?: string }
if (!payload.apiKey) throw new Error('Disposable Preview key response did not contain a key.')

const originalFetch = globalThis.fetch
if (bypass) {
  globalThis.fetch = (input, init) => {
    const requestHeaders = new Headers(init?.headers)
    requestHeaders.set('x-vercel-protection-bypass', bypass)
    return originalFetch(input, { ...init, headers: requestHeaders })
  }
}
const maha = new MahaClient({ apiKey: payload.apiKey, baseUrl })
try {
  await runRestoredEngineE2e(maha, baseUrl)
} finally {
  await maha.revokeApiKey()
  console.log('✔ disposable Preview API key revoked')
}
