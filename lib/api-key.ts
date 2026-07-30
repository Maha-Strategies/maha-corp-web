/** Edge-safe API key, prepaid-credit, and Upstash REST helpers. */
export type ApiKeyTier = 'starter' | 'builder' | 'scale' | 'enterprise'
// Redis hash values are strings. `zero_data_retention` is written for every
// newly-issued key and gives the request path an explicit no-log/no-cache policy.
export type ApiKeyRecord = { key_id: string; email_hash: string; balance_credits: string; tier: ApiKeyTier; status: 'active'; rate_limit_per_minute: string; zero_data_retention?: 'true'; created_at: string }

const STARTER_CREDITS = 20_000
const KEY_PREFIX = 'mha_live_'
const YEAR_SECONDS = 31_536_000

export class ApiKeyConfigurationError extends Error {
  constructor() { super('Upstash Redis is not configured.'); this.name = 'ApiKeyConfigurationError' }
}

export class UpstashRedisError extends Error {
  readonly code: 'upstash_connection_failed' | 'upstash_request_failed' | 'upstash_response_invalid'
  constructor(code: 'upstash_connection_failed' | 'upstash_request_failed' | 'upstash_response_invalid', message: string) { super(message); this.name = 'UpstashRedisError'; this.code = code }
}

function sanitizedEnvironmentValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '') || undefined
}

function redisConfiguration() {
  const url = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_URL)
  const token = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_TOKEN)
  if (!url || !token) throw new ApiKeyConfigurationError()
  return { url: url.replace(/\/$/, ''), token }
}

export function apiKeyServiceConfigured() { const { url, token } = { url: sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_URL), token: sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_TOKEN) }; return Boolean(url && token) }
export async function sha256(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
/** Remove transport-only whitespace and accidental shell/JSON quote wrappers. */
export function canonicalApiKey(rawKey: string) {
  let key = rawKey.trim()
  while (key.length >= 2 && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) key = key.slice(1, -1).trim()
  return key
}
// This is the sole hash boundary for API keys. Both creation and validation use
// this Web Crypto implementation, yielding the same lower-case hexadecimal SHA-256.
export async function hashApiKey(rawKey: string) { return sha256(canonicalApiKey(rawKey)) }
function randomBase64Url(length = 32) { const bytes = crypto.getRandomValues(new Uint8Array(length)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }
export function createApiKey() { return `${KEY_PREFIX}${randomBase64Url()}` }
export function createApiKeyId() { return `key_${crypto.randomUUID().replaceAll('-', '')}` }
export function bearerApiKey(request: Request) { const authHeader = request.headers.get('authorization') || ''; const rawKey = canonicalApiKey(authHeader.replace(/^Bearer\s+/i, '')); return rawKey || null }

async function redis<T>(command: string, args: unknown[]): Promise<T> {
  const config = redisConfiguration()
  // Upstash command-body requests must target the bare REST URL and include the
  // command as the first JSON-array item: ["HSET", key, field, value, ...].
  // Posting an argument array to /hset makes it one final Redis argument.
  const serializedArgs = args.map((argument) => typeof argument === 'number' ? String(argument) : argument)
  let response: Response
  try { response = await fetch(config.url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify([command, ...serializedArgs]), cache: 'no-store' }) } catch (error) { throw new UpstashRedisError('upstash_connection_failed', `Upstash ${command} connection failed: ${error instanceof Error ? error.message : 'unknown network error'}`) }
  if (!response.ok) throw new UpstashRedisError('upstash_request_failed', `Upstash ${command} returned HTTP ${response.status}.`)
  let data: { result: T; error?: string }
  try { data = await response.json() as { result: T; error?: string } } catch { throw new UpstashRedisError('upstash_response_invalid', `Upstash ${command} returned invalid JSON.`) }
  if (data.error) throw new UpstashRedisError('upstash_request_failed', `Upstash ${command} rejected the request.`)
  return data.result
}

export function apiKeyDataRedisKey(hash: string) { return `key:data:${hash}` }
function idKey(id: string) { return `key:id:${id}` }
export async function getApiKeyRecord(hash: string): Promise<ApiKeyRecord | null> { const record = await redis<Record<string, string> | null>('HGETALL', [apiKeyDataRedisKey(hash)]); return record?.key_id ? record as ApiKeyRecord : null }
export async function getApiKeyRecordForRawKey(rawKey: string): Promise<ApiKeyRecord | null> {
  const key = canonicalApiKey(rawKey); const hash = await hashApiKey(key)
  if (process.env.NODE_ENV !== 'production') console.log('[KEY_LOOKUP_DEBUG]', { rawKeyPrefix: key.slice(0, 10), hash })
  return getApiKeyRecord(hash)
}

export function zeroDataRetentionEnabled(record: Pick<ApiKeyRecord, 'zero_data_retention'>) { return record.zero_data_retention === 'true' }

export async function provisionStarterKey(email: string) {
  const key = createApiKey(); const keyId = createApiKeyId(); const hash = await hashApiKey(key); const emailHash = await sha256(email); const createdAt = new Date().toISOString()
  await redis('HSET', [apiKeyDataRedisKey(hash), 'key_id', keyId, 'email_hash', emailHash, 'balance_credits', String(STARTER_CREDITS), 'tier', 'starter', 'status', 'active', 'rate_limit_per_minute', '30', 'zero_data_retention', 'true', 'created_at', createdAt])
  await redis('SET', [idKey(keyId), hash, 'EX', YEAR_SECONDS, 'NX'])
  return { key, keyId, balanceCredits: STARTER_CREDITS, tier: 'starter' as const }
}

export type ApiAccess = { kind: 'authorized'; keyId: string; tier: ApiKeyTier; zeroDataRetention: boolean; remainingCredits: number; remainingRequests: number } | { kind: 'unauthorized' | 'depleted' | 'rate_limited' | 'unavailable' }
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
export async function authorizeAndConsumeApiUnit(rawKey: string): Promise<ApiAccess> {
  if (!apiKeyServiceConfigured()) return { kind: 'unavailable' }
  try { const key = canonicalApiKey(rawKey); const hash = await hashApiKey(key); if (process.env.NODE_ENV !== 'production') console.log('[KEY_LOOKUP_DEBUG]', { rawKeyPrefix: key.slice(0, 10), hash }); const bucket = Math.floor(Date.now() / 60_000); const result = await redis<number[]>('EVAL', [CONSUME_SCRIPT, 2, apiKeyDataRedisKey(hash), `key:rate:${hash}:${bucket}`, 30]); const [code, credits, requests] = result
    if (code === 1) { const record = await getApiKeyRecord(hash); return record ? { kind: 'authorized', keyId: record.key_id, tier: record.tier, zeroDataRetention: zeroDataRetentionEnabled(record), remainingCredits: credits, remainingRequests: requests } : { kind: 'unavailable' } }
    if (code === 2) return { kind: 'depleted' }; if (code === 3) return { kind: 'rate_limited' }; return { kind: 'unauthorized' }
  } catch { return { kind: 'unavailable' } }
}
export async function consumeProvisioningLimit(ip: string) { if (!apiKeyServiceConfigured()) throw new ApiKeyConfigurationError(); const digest = await sha256(ip); const bucket = Math.floor(Date.now() / 3_600_000); const count = await redis<number>('INCR', [`key:provision:${digest}:${bucket}`]); if (count === 1) await redis('EXPIRE', [`key:provision:${digest}:${bucket}`, 3600]); return count <= 3 }
export async function keyHashForId(keyId: string) { return redis<string | null>('GET', [idKey(keyId)]) }
const ADDITIONAL_CREDIT_SCRIPT = `
local record = KEYS[1]
local credits = tonumber(ARGV[1])
if redis.call('EXISTS', record) == 0 then return -2 end
local balance = tonumber(redis.call('HGET', record, 'balance_credits') or '0')
if balance < credits then return -1 end
return redis.call('HINCRBY', record, 'balance_credits', -credits)
`
export async function consumeAdditionalApiCredits(keyId: string, credits: number) {
  if (!Number.isInteger(credits) || credits < 0) throw new Error('credits must be a non-negative integer.')
  if (credits === 0) return { kind: 'charged' as const, remainingCredits: null }
  const hash = await keyHashForId(keyId)
  if (!hash) return { kind: 'unavailable' as const }
  const result = await redis<number>('EVAL', [ADDITIONAL_CREDIT_SCRIPT, 1, apiKeyDataRedisKey(hash), String(credits)])
  if (result === -1) return { kind: 'depleted' as const }
  if (result === -2) return { kind: 'unavailable' as const }
  return { kind: 'charged' as const, remainingCredits: result }
}
export async function creditKeyById(keyId: string, credits: number) { const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.'); return redis<number>('HINCRBY', [apiKeyDataRedisKey(hash), 'balance_credits', credits]) }
export async function creditKeyOnce(eventId: string, keyId: string, credits: number) { const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.'); const script = `if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 2592000) then return redis.call('HINCRBY', KEYS[2], 'balance_credits', ARGV[1]) end return false`; return redis<number | false>('EVAL', [script, 2, `stripe:event:${eventId}`, apiKeyDataRedisKey(hash), String(credits)]) }
