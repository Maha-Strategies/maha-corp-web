import { createRequire } from 'node:module'
import { getRedis } from '../lib/redis.ts'
import { scopedRedisKey } from '../lib/redis-namespace.ts'

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const days = Number(process.argv[2] ?? 7)
if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Choose 1-90 days.')
const rows = []
for (let offset = 0; offset < days; offset++) {
  const date = new Date(); date.setUTCDate(date.getUTCDate() - offset)
  const day = date.toISOString().slice(0, 10)
  const counts = await getRedis().hgetall(scopedRedisKey(`context-review:counts:${day}`))
  rows.push({ day, counts: counts ?? {} })
}
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), rows,
  interpretation: 'Service executions are observed; browser signals and channel labels are unverified. No unique-user, retention, inquiry or revenue claim can be inferred.' }, null, 2))
