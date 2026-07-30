/** Edge-safe API key, prepaid-credit, and Upstash REST helpers. */
export type ApiKeyTier = 'starter' | 'builder' | 'scale'
export type ApiKeyRecord = { key_id: string; email_hash: string; balance_credits: string; tier: ApiKeyTier; status: 'active'; rate_limit_per_minute: string; created_at: string }

const STARTER_CREDITS = 20_000
const KEY_PREFIX = 'mha_live_'
const YEAR_SECONDS = 31_536_000

function redisConfiguration() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis is not configured.')
  return { url: url.replace(/\/$/, ''), token }
}

export function apiKeyServiceConfigured() { return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) }
export async function sha256(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
function randomBase64Url(length = 32) { const bytes = crypto.getRandomValues(new Uint8Array(length)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }
export function createApiKey() { return `${KEY_PREFIX}${randomBase64Url()}` }
export function createApiKeyId() { return `key_${crypto.randomUUID().replaceAll('-', '')}` }
export function bearerApiKey(request: Request) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null }

async function redis<T>(command: string, args: unknown[]): Promise<T> {
  const config = redisConfiguration(); const response = await fetch(`${config.url}/${command.toLowerCase()}`, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), cache: 'no-store' })
  if (!response.ok) throw new Error(`Upstash ${command} failed.`)
  const data = await response.json() as { result: T; error?: string }; if (data.error) throw new Error(`Upstash ${command} failed.`); return data.result
}

function dataKey(hash: string) { return `key:data:${hash}` }
function idKey(id: string) { return `key:id:${id}` }
export async function getApiKeyRecord(hash: string): Promise<ApiKeyRecord | null> { const record = await redis<Record<string, string> | null>('HGETALL', [dataKey(hash)]); return record?.key_id ? record as ApiKeyRecord : null }

export async function provisionStarterKey(email: string) {
  const key = createApiKey(); const keyId = createApiKeyId(); const hash = await sha256(key); const emailHash = await sha256(email); const createdAt = new Date().toISOString()
  await redis('HSET', [dataKey(hash), 'key_id', keyId, 'email_hash', emailHash, 'balance_credits', String(STARTER_CREDITS), 'tier', 'starter', 'status', 'active', 'rate_limit_per_minute', '30', 'created_at', createdAt])
  await redis('SET', [idKey(keyId), hash, 'EX', YEAR_SECONDS, 'NX'])
  return { key, keyId, balanceCredits: STARTER_CREDITS, tier: 'starter' as const }
}

export type ApiAccess = { kind: 'authorized'; keyId: string; remainingCredits: number; remainingRequests: number } | { kind: 'unauthorized' | 'depleted' | 'rate_limited' | 'unavailable' }
const CONSUME_SCRIPT = `
local record = KEYS[1]
local window = KEYS[2]
if redis.call('EXISTS', record) == 0 then return {0, -1, -1} end
if redis.call('HGET', record, 'status') ~= 'active' then return {0, -1, -1} end
local balance = tonumber(redis.call('HGET', record, 'balance_credits') or '0')
if balance <= 0 then return {2, 0, -1} end
local limit = tonumber(redis.call('HGET', record, 'rate_limit_per_minute') or ARGV[1])
local current = redis.call('INCR', window)
if current == 1 then redis.call('EXPIRE', window, 60) end
if current > limit then return {3, balance, 0} end
local remaining = redis.call('HINCRBY', record, 'balance_credits', -1)
return {1, remaining, limit - current}
`
export async function authorizeAndConsumeApiUnit(key: string): Promise<ApiAccess> {
  if (!apiKeyServiceConfigured()) return { kind: 'unavailable' }
  try { const hash = await sha256(key); const bucket = Math.floor(Date.now() / 60_000); const result = await redis<number[]>('EVAL', [CONSUME_SCRIPT, 2, dataKey(hash), `key:rate:${hash}:${bucket}`, 30]); const [code, credits, requests] = result
    if (code === 1) { const record = await getApiKeyRecord(hash); return record ? { kind: 'authorized', keyId: record.key_id, remainingCredits: credits, remainingRequests: requests } : { kind: 'unavailable' } }
    if (code === 2) return { kind: 'depleted' }; if (code === 3) return { kind: 'rate_limited' }; return { kind: 'unauthorized' }
  } catch { return { kind: 'unavailable' } }
}
export async function consumeProvisioningLimit(ip: string) { if (!apiKeyServiceConfigured()) return true; try { const digest = await sha256(ip); const bucket = Math.floor(Date.now() / 3_600_000); const count = await redis<number>('INCR', [`key:provision:${digest}:${bucket}`]); if (count === 1) await redis('EXPIRE', [`key:provision:${digest}:${bucket}`, 3600]); return count <= 3 } catch { return false } }
export async function keyHashForId(keyId: string) { return redis<string | null>('GET', [idKey(keyId)]) }
export async function creditKeyById(keyId: string, credits: number) { const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.'); return redis<number>('HINCRBY', [dataKey(hash), 'balance_credits', credits]) }
export async function creditKeyOnce(eventId: string, keyId: string, credits: number) { const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.'); const script = `if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 2592000) then return redis.call('HINCRBY', KEYS[2], 'balance_credits', ARGV[1]) end return false`; return redis<number | false>('EVAL', [script, 2, `stripe:event:${eventId}`, dataKey(hash), String(credits)]) }
