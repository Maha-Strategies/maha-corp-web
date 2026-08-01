/** Edge-safe API key, prepaid-credit, and Upstash REST helpers. */
export type ApiKeyTier = 'starter' | 'builder' | 'scale' | 'enterprise'
// Upstash hash values are strings. Parse them at this boundary so downstream
// authorization and balance code only handles the correctly typed record.
export type ApiKeyRecord = { key_id: string; email_hash: string; balance_credits: number; tier: ApiKeyTier; status: 'active'; rate_limit_per_minute: number; zero_data_retention: boolean; created_at: string }

const STARTER_CREDITS = 20_000
const KEY_PREFIX = 'mha_live_'
const YEAR_SECONDS = 31_536_000
// Diagnostics are opt-in only. Production behavior is silent unless an
// operator explicitly sets this exact value to "true".
export const apiKeyDiagnosticsEnabled = process.env.API_KEY_DIAGNOSTICS === 'true'

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
export async function hashApiKey(rawKey: string): Promise<string> { return sha256(canonicalApiKey(rawKey)) }
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
function hashResultToRecord(result: Record<string, string> | string[] | null): Record<string, string> | null {
  if (!result) return null
  if (!Array.isArray(result)) return result
  // Upstash REST returns HGETALL as [field, value, field, value, ...] for
  // this endpoint. Normalize it before applying the typed-record validator.
  if (result.length % 2 !== 0) return null
  const record: Record<string, string> = {}
  for (let index = 0; index < result.length; index += 2) {
    const field = result[index]; const value = result[index + 1]
    if (typeof field !== 'string' || typeof value !== 'string') return null
    record[field] = value
  }
  return record
}
export async function getApiKeyRecord(hash: string): Promise<ApiKeyRecord | null> {
  const redisKey = apiKeyDataRedisKey(hash)
  // Key data is stored as a Redis hash via HSET in provisionStarterKey, so it
  // must be retrieved as the same hash via HGETALL (never GET/JSON.parse).
  const result = await redis<Record<string, string> | string[] | null>('HGETALL', [redisKey])
  const rawRecord = hashResultToRecord(result)
  const balanceCredits = Number(rawRecord?.balance_credits)
  const rateLimit = Number(rawRecord?.rate_limit_per_minute)
  const tiers: ApiKeyTier[] = ['starter', 'builder', 'scale', 'enterprise']
  if (!rawRecord?.key_id || typeof rawRecord.email_hash !== 'string' || !tiers.includes(rawRecord.tier as ApiKeyTier) || rawRecord.status !== 'active' || !Number.isFinite(balanceCredits) || balanceCredits < 0 || !Number.isFinite(rateLimit) || rateLimit < 1 || typeof rawRecord.created_at !== 'string') {
    return null
  }
  return {
    key_id: rawRecord.key_id,
    email_hash: rawRecord.email_hash,
    balance_credits: balanceCredits,
    tier: rawRecord.tier as ApiKeyTier,
    status: 'active',
    rate_limit_per_minute: rateLimit,
    zero_data_retention: String(rawRecord.zero_data_retention) === 'true',
    created_at: rawRecord.created_at,
  }
}
export async function getApiKeyRecordForRawKey(rawKey: string): Promise<ApiKeyRecord | null> {
  const key = canonicalApiKey(rawKey); const hash = await hashApiKey(key)
  return getApiKeyRecord(hash)
}

export function zeroDataRetentionEnabled(record: Pick<ApiKeyRecord, 'zero_data_retention'>) { return record.zero_data_retention }

export async function provisionStarterKey(email: string) {
  const key = createApiKey(); const keyId = createApiKeyId(); const hash = await hashApiKey(key); const emailHash = await sha256(email); const createdAt = new Date().toISOString()
  const redisKey = apiKeyDataRedisKey(hash)
  // HSET and the HGETALL read above intentionally operate on this exact key.
  await redis('HSET', [redisKey, 'key_id', keyId, 'email_hash', emailHash, 'balance_credits', String(STARTER_CREDITS), 'tier', 'starter', 'status', 'active', 'rate_limit_per_minute', '30', 'zero_data_retention', 'true', 'created_at', createdAt])
  await redis('SET', [idKey(keyId), hash, 'EX', YEAR_SECONDS, 'NX'])
  return { key, keyId, balanceCredits: STARTER_CREDITS, tier: 'starter' as const }
}

const ROTATE_KEY_SCRIPT = `
local previous = KEYS[1]
local replacement = KEYS[2]
local keyIndex = KEYS[3]
if redis.call('EXISTS', previous) == 0 or redis.call('HGET', previous, 'status') ~= 'active' then return 0 end
if redis.call('EXISTS', replacement) ~= 0 then return -1 end
local keyId = redis.call('HGET', previous, 'key_id')
if not keyId then return -1 end
local fields = {'email_hash', 'balance_credits', 'tier', 'rate_limit_per_minute', 'zero_data_retention', 'created_at'}
for _, field in ipairs(fields) do
  local value = redis.call('HGET', previous, field)
  if value == false then return -1 end
  redis.call('HSET', replacement, field, value)
end
redis.call('HSET', replacement, 'key_id', keyId, 'status', 'active', 'rotated_at', ARGV[1])
redis.call('HSET', previous, 'status', 'revoked', 'revoked_at', ARGV[1], 'rotated_to', ARGV[2])
local ttl = redis.call('TTL', keyIndex)
if ttl > 0 then redis.call('SET', keyIndex, ARGV[3], 'EX', ttl) else redis.call('SET', keyIndex, ARGV[3]) end
return 1
`

const REVOKE_KEY_SCRIPT = `
local record = KEYS[1]
if redis.call('EXISTS', record) == 0 or redis.call('HGET', record, 'status') ~= 'active' then return 0 end
redis.call('HSET', record, 'status', 'revoked', 'revoked_at', ARGV[1])
return 1
`

/** Replaces the raw credential while preserving its key ID, balance, and tenant-scoped resources. */
export async function rotateApiKey(rawKey: string) {
  const previousHash = await hashApiKey(rawKey)
  const replacement = createApiKey()
  const replacementHash = await hashApiKey(replacement)
  const record = await getApiKeyRecord(previousHash)
  if (!record) return null
  const result = await redis<number>('EVAL', [ROTATE_KEY_SCRIPT, 3, apiKeyDataRedisKey(previousHash), apiKeyDataRedisKey(replacementHash), idKey(record.key_id), new Date().toISOString(), replacementHash, replacementHash])
  if (result !== 1) return null
  return { key: replacement, keyId: record.key_id, balanceCredits: record.balance_credits, tier: record.tier }
}

/** Permanently disables the supplied raw credential. A revoked key cannot be reactivated. */
export async function revokeApiKey(rawKey: string) {
  const hash = await hashApiKey(rawKey)
  return (await redis<number>('EVAL', [REVOKE_KEY_SCRIPT, 1, apiKeyDataRedisKey(hash), new Date().toISOString()])) === 1
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
  try { const key = canonicalApiKey(rawKey); const hash = await hashApiKey(key); const bucket = Math.floor(Date.now() / 60_000); const result = await redis<number[]>('EVAL', [CONSUME_SCRIPT, 2, apiKeyDataRedisKey(hash), `key:rate:${hash}:${bucket}`, 30]); const [code, credits, requests] = result
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
// Keep Stripe event claims permanently: a completed payment must never credit
// twice merely because a provider retries after the usual webhook window.
export async function creditKeyOnce(eventId: string, keyId: string, credits: number) { const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.'); const script = `if redis.call('SET', KEYS[1], '1', 'NX') then return redis.call('HINCRBY', KEYS[2], 'balance_credits', ARGV[1]) end return false`; return redis<number | false>('EVAL', [script, 2, `stripe:event:${eventId}`, apiKeyDataRedisKey(hash), String(credits)]) }
export async function reverseKeyCreditsOnce(eventId: string, keyId: string, credits: number) {
  if (!Number.isInteger(credits) || credits < 0) throw new Error('credits must be a non-negative integer.')
  const hash = await keyHashForId(keyId); if (!hash) throw new Error('API key does not exist.')
  const script = `if redis.call('SET', KEYS[1], '1', 'NX') then local balance=tonumber(redis.call('HGET', KEYS[2], 'balance_credits') or '0'); local requested=tonumber(ARGV[1]); if balance<requested then redis.call('HSET', KEYS[2], 'balance_credits', '0', 'status', 'suspended'); return {1,0,1} end return {1,redis.call('HINCRBY', KEYS[2], 'balance_credits', -requested),0} end return {0,tonumber(redis.call('HGET', KEYS[2], 'balance_credits') or '0'),redis.call('HGET', KEYS[2], 'status') == 'suspended' and 1 or 0}`
  const result = await redis<number[]>('EVAL', [script, 2, `stripe:reversal:${eventId}`, apiKeyDataRedisKey(hash), String(credits)])
  return { applied: result[0] === 1, balanceCredits: result[1], suspended: result[2] === 1 }
}
