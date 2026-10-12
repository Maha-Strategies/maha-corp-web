import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpsRequest } from 'node:https'

export type PublicRead = { status: number; headers: Record<string, string>; body: string; durationMs: number }
export type PublicTarget = { url: string; method: 'GET' | 'POST'; body?: string }
export type PublicTransport = (target: PublicTarget, address: string) => Promise<PublicRead>
export type PublicResolver = (host: string) => Promise<string[]>
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false
  const [a, b, c] = address.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
}
export function publicTargetUrl(value: string): string {
  const url = new URL(value), host = url.hostname
  if (value.length > 1024 || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.port || isIP(host) || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|example|invalid)$/.test(host)
    || value !== url.href) throw new Error('public_target_not_allowed')
  return url.href
}
const resolvePublic: PublicResolver = async host => (await lookup(host, { all: true, family: 4, verbatim: true })).map(row => row.address)
/** The validated address is pinned into lookup. TLS still verifies the original hostname. */
export const pinnedHttpsTransport: PublicTransport = async (target, address) => new Promise((resolve, reject) => {
  const url = new URL(target.url), started = performance.now()
  let finished = false
  const fail = (code: string) => { if (!finished) { finished = true; reject(new Error(code)) } }
  const request = httpsRequest(url, { method: target.method, family: 4, rejectUnauthorized: true,
    lookup: (_host, options, callback) => { if (options.all) callback(null, [{ address, family: 4 }]); else callback(null, address, 4) },
    headers: { accept: 'text/html, text/plain, application/json', 'accept-encoding': 'identity',
      'user-agent': 'Maha-Public-Observation/1.0', ...(target.method === 'POST' ? { 'content-type': 'application/json' } : {}) },
  }, response => {
    const chunks: Buffer[] = [], headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(response.headers)) if (typeof value === 'string') headers[key] = value
    let size = 0
    if ((headers['content-encoding'] && headers['content-encoding'] !== 'identity') || Number(headers['content-length'] ?? 0) > 131072) {
      response.destroy(); request.destroy(); fail('upstream_body_unsupported'); return
    }
    response.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 131072) { response.destroy(); request.destroy(); fail('upstream_body_too_large') }
      else chunks.push(chunk)
    })
    response.on('error', () => fail('upstream_unavailable'))
    response.on('end', () => {
      if (finished) return
      try {
        // Preserve a UTF-8 BOM so re-encoding body reproduces the raw byte hash.
        const body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks))
        finished = true; resolve({ status: response.statusCode ?? 502, headers, body, durationMs: Math.min(30000, Math.round(performance.now() - started)) })
      } catch { fail('upstream_invalid_utf8') }
    })
  })
  const timer = setTimeout(() => { request.destroy(); fail('upstream_timeout') }, 10000)
  request.on('error', () => fail('upstream_unavailable'))
  request.on('close', () => clearTimeout(timer))
  if (target.body) request.write(target.body)
  request.end()
})
export function createPublicReader(allowed: readonly PublicTarget[], dependencies: { resolve?: PublicResolver; transport?: PublicTransport } = {}) {
  const targets = new Map(allowed.map(target => [publicTargetUrl(target.url), target]))
  if (targets.size !== allowed.length) throw new Error('duplicate_public_targets')
  return async (resource: string): Promise<PublicRead> => {
    const target = targets.get(publicTargetUrl(resource))
    if (!target || (target.body && Buffer.byteLength(target.body) > 4096)) throw new Error('public_target_not_allowed')
    let timer: ReturnType<typeof setTimeout> | undefined
    let addresses: string[]
    try { addresses = await Promise.race([(dependencies.resolve ?? resolvePublic)(new URL(resource).hostname),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('public_dns_unavailable')), 4000) })]) }
    catch { throw new Error('public_dns_unavailable') }
    finally { clearTimeout(timer) }
    if (!addresses.length || addresses.some(address => !publicIPv4(address))) throw new Error('non_public_dns')
    const response = await (dependencies.transport ?? pinnedHttpsTransport)(target, addresses[0])
    if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599 || Buffer.byteLength(response.body) > 131072
      || !Number.isInteger(response.durationMs) || response.durationMs < 0 || response.durationMs > 30000) throw new Error('invalid_public_response')
    // Never follow redirects; the next target has not been approved or resolved.
    if (response.status >= 300 && response.status < 400) throw new Error('public_redirect_not_allowed')
    return response
  }
}
