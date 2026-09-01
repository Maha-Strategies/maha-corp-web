/**
 * Where the post-run provider probes send their requests.
 *
 * The probes carry live credentials, so an override that could name any host
 * would be a way to exfiltrate one by setting an environment variable. Only
 * loopback is accepted, and an override that is not loopback throws rather than
 * falling back to the real endpoint - a misconfigured value must not silently
 * become a production call either.
 *
 * This exists so the collector and the finalizer cannot drift into two
 * different ideas of what an acceptable override is.
 */

export const PROVIDER_ENDPOINTS = {
  supabase: 'https://api.supabase.com',
  vercel: 'https://api.vercel.com',
  github: 'https://api.github.com',
} as const

export type ProviderName = keyof typeof PROVIDER_ENDPOINTS

/** The environment variable that may redirect each provider, to loopback only. */
export const ENDPOINT_OVERRIDES = {
  supabase: 'MAHA_B11_SUPABASE_API',
  vercel: 'MAHA_B11_VERCEL_API',
  github: 'MAHA_B11_GITHUB_API',
} as const satisfies Readonly<Record<ProviderName, string>>

export function providerEndpoint(provider: ProviderName, env: NodeJS.ProcessEnv = process.env): string {
  const name = ENDPOINT_OVERRIDES[provider]
  const override = env[name]?.trim()
  if (!override) return PROVIDER_ENDPOINTS[provider]
  let url: URL
  try {
    url = new URL(override)
  } catch {
    throw new Error(`${name} is not a URL.`)
  }
  if (url.protocol !== 'http:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
    throw new Error(`${name} may only point at http://127.0.0.1; refusing to send a credential elsewhere.`)
  }
  return override.replace(/\/+$/, '')
}
