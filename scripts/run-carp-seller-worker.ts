import { handleCarpSellerRequest, type CarpSellerRequest } from '../lib/carp/seller.ts'

type PendingRequest = { method: string; params: unknown; client: string; cookie: string }
type WorkerOptions = { baseUrl: string; timeoutMs: number; fetchImpl?: typeof fetch }

function safeCookie(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:+\/-]{1,256}$/.test(value)) {
    throw new Error('CARP request cookie is missing or unsafe for a Cookie header.')
  }
  return value
}

function safeClientKey(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:[A-Fa-f0-9]{66}|[A-Fa-f0-9]{130})$/.test(value)) {
    throw new Error('CARP client must be a compressed or uncompressed secp256k1 public key.')
  }
  return value
}

function pendingRequest(value: unknown): PendingRequest | null {
  if (Array.isArray(value) && value.length === 0) return null
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CARP nextrequest returned a malformed payload.')
  }
  const candidate = value as Record<string, unknown>
  if (typeof candidate.method !== 'string' || candidate.method.length === 0 || candidate.method.length > 80) {
    throw new Error('CARP nextrequest returned an invalid method.')
  }
  return {
    method: candidate.method,
    params: candidate.params,
    client: safeClientKey(candidate.client),
    cookie: safeCookie(candidate.cookie),
  }
}

export async function pollCarpSeller(options: WorkerOptions): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const signal = AbortSignal.timeout(options.timeoutMs)
  const response = await fetchImpl(`${baseUrl}/cgi-bin/nextrequest`, {
    headers: { Accept: 'application/json', 'User-Agent': 'maha-carp-seller/0.1' },
    signal,
  })
  if (!response.ok) throw new Error(`CARP nextrequest failed with HTTP ${response.status}.`)
  const pending = pendingRequest(await response.json())
  if (!pending) return false

  const request: CarpSellerRequest = {
    jsonrpc: '2.0',
    method: pending.method,
    params: pending.params,
    id: pending.cookie,
  }
  const reply = handleCarpSellerRequest(request)
  const delivered = await fetchImpl(`${baseUrl}/cgi-bin/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `agent=${pending.client}; cookie=${pending.cookie}`,
      'User-Agent': 'maha-carp-seller/0.1',
    },
    body: JSON.stringify(reply),
    signal,
  })
  if (!delivered.ok) throw new Error(`CARP result delivery failed with HTTP ${delivered.status}: ${await delivered.text()}`)
  return true
}

async function run() {
  const baseUrl = (process.env.CARP_INTERFACE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const once = process.argv.includes('--once')
  const interval = Number(process.env.CARP_POLL_INTERVAL_MS ?? '2000')
  const timeoutMs = Number(process.env.CARP_REQUEST_TIMEOUT_MS ?? '10000')

  if (!Number.isInteger(interval) || interval < 250 || interval > 60_000) {
    throw new Error('CARP_POLL_INTERVAL_MS must be an integer from 250 to 60000.')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error('CARP_REQUEST_TIMEOUT_MS must be an integer from 1000 to 60000.')
  }

  do {
    try {
      const handled = await pollCarpSeller({ baseUrl, timeoutMs })
      if (once) break
      if (!handled) await new Promise((resolve) => setTimeout(resolve, interval))
    } catch (error) {
      if (once) throw error
      console.error('CARP Seller poll failed:', error instanceof Error ? error.message : 'unknown error')
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  } while (true)
}

if (import.meta.main) await run()
