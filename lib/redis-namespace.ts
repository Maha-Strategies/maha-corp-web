function sanitized(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '') || undefined
}

type RedisEnvironment = { NODE_ENV?: string; MAHA_REDIS_NAMESPACE?: string; VERCEL_ENV?: string }

/** Production keeps its historical unprefixed keyspace. Vercel Preview and
 * Development deployments are isolated automatically. */
export function redisNamespace(environment: RedisEnvironment = process.env): string | null {
  const explicit = sanitized(environment.MAHA_REDIS_NAMESPACE)
  if (explicit) {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(explicit)) throw new Error('MAHA_REDIS_NAMESPACE must be a 1-32 character slug.')
    return explicit.toLowerCase()
  }
  const vercelEnvironment = sanitized(environment.VERCEL_ENV)
  if (vercelEnvironment === 'preview' || vercelEnvironment === 'development') return vercelEnvironment
  return null
}

export function scopedRedisKey(key: string, environment: RedisEnvironment = process.env) {
  const namespace = redisNamespace(environment)
  return namespace ? `maha:${namespace}:${key}` : key
}
