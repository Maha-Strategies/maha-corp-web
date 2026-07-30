import { Redis } from '@upstash/redis'

type StoredApiKeyData = Record<string, unknown>

function sanitizedEnvironmentValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '') || undefined
}

const url = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_URL)
const token = sanitizedEnvironmentValue(process.env.UPSTASH_REDIS_REST_TOKEN)

if (!url || !token) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.')
}

export const redis = new Redis({ url, token })

/**
 * Load a key record by its public key ID.
 *
 * `apiKey:<id>` is retained as a compatibility read for the proposed dashboard
 * schema. Phase 1 records use `key:id:<id>` -> SHA-256 hash ->
 * `key:data:<hash>`, so that path is the authoritative fallback.
 */
export async function getApiKeyData(apiKeyId: string): Promise<StoredApiKeyData | null> {
  const directRecord = await redis.hgetall<StoredApiKeyData>(`apiKey:${apiKeyId}`)
  if (directRecord) return directRecord

  const keyHash = await redis.get<string>(`key:id:${apiKeyId}`)
  if (!keyHash) return null
  return redis.hgetall<StoredApiKeyData>(`key:data:${keyHash}`)
}
