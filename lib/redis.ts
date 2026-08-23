import { Redis } from '@upstash/redis'
import { scopedRedisKey } from './redis-namespace.ts'

type StoredApiKeyData = Record<string, unknown>

function sanitizedEnvironmentValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '') || undefined
}

export class RedisConfigurationError extends Error {
  constructor() {
    super('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for Redis-backed operations.')
    this.name = 'RedisConfigurationError'
  }
}

let client: Redis | undefined

/**
 * Constructs the Redis client only when a Redis-backed operation is invoked.
 *
 * This keeps static generation and local builds independent of operational
 * secrets, while preserving fail-closed behavior for every queue, ledger, and
 * key-management path that actually needs durable Redis state.
 */
export function getRedis(): Redis {
  if (client) return client

  const url = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_URL)
  const token = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_TOKEN)
  if (!url || !token) throw new RedisConfigurationError()

  client = new Redis({ url, token })
  return client
}

/**
 * Compatibility facade for existing call sites. Property access resolves the
 * real client lazily, so importing this module cannot make a build depend on
 * Redis credentials. Method calls retain the Redis instance as `this`.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, property) {
    const value = Reflect.get(getRedis(), property)
    return typeof value === 'function' ? value.bind(getRedis()) : value
  },
})

/**
 * Load a key record by its public key ID.
 *
 * `apiKey:<id>` is retained as a compatibility read for the proposed dashboard
 * schema. Phase 1 records use `key:id:<id>` -> SHA-256 hash ->
 * `key:data:<hash>`, so that path is the authoritative fallback.
 */
export async function getApiKeyData(apiKeyId: string): Promise<StoredApiKeyData | null> {
  const redis = getRedis()
  const directRecord = await redis.hgetall<StoredApiKeyData>(scopedRedisKey(`apiKey:${apiKeyId}`))
  if (directRecord) return directRecord

  const keyHash = await redis.get<string>(scopedRedisKey(`key:id:${apiKeyId}`))
  if (!keyHash) return null
  return redis.hgetall<StoredApiKeyData>(scopedRedisKey(`key:data:${keyHash}`))
}
