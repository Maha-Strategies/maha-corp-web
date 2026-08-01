import { canonicalApiKey, hashApiKey } from '../lib/api-key.ts'

function required(name: string) {
  const value = process.env[name]?.trim().replace(/^['"]|['"]$/g, '')
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function main() {
  const url = required('UPSTASH_REDIS_REST_URL').replace(/\/$/, '')
  const token = required('UPSTASH_REDIS_REST_TOKEN')
  const rawKey = canonicalApiKey(required('STAGING_API_KEY'))
  const namespace = (process.env.TARGET_REDIS_NAMESPACE?.trim() || 'preview').toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(namespace)) throw new Error('TARGET_REDIS_NAMESPACE must be a 1-32 character slug.')
  const hash = await hashApiKey(rawKey)
  const prefix = `maha:${namespace}:`
  const script = `
local source=KEYS[1]
local target=KEYS[2]
local tenant=KEYS[3]
local keyIndex=KEYS[4]
if redis.call('EXISTS',source)==0 or redis.call('HGET',source,'status')~='active' then return -1 end
if redis.call('EXISTS',target)~=0 or redis.call('EXISTS',tenant)~=0 then return 0 end
local keyId=redis.call('HGET',source,'key_id')
local tenantId=redis.call('HGET',source,'tenant_id')
local emailHash=redis.call('HGET',source,'email_hash')
local zdr=redis.call('HGET',source,'zero_data_retention') or 'true'
local createdAt=redis.call('HGET',source,'created_at') or ARGV[2]
if not keyId or not tenantId or not emailHash then return -1 end
redis.call('HSET',target,'key_id',keyId,'tenant_id',tenantId,'email_hash',emailHash,'balance_credits',ARGV[1],'tier','starter','status','active','rate_limit_per_minute','30','zero_data_retention',zdr,'created_at',createdAt)
redis.call('HSET',tenant,'subscription_credits','0','topup_credits',ARGV[1],'tier','starter','rate_limit_per_minute','30','auto_topup_enabled','false','subscription_status','none','created_at',createdAt)
redis.call('SET',keyIndex,ARGV[3])
return 1`
  const body = ['EVAL', script, '4', `key:data:${hash}`, `${prefix}key:data:${hash}`, `${prefix}tenant:data:tenant_pending`, `${prefix}key:id:key_pending`, '20000', new Date().toISOString(), hash]
  // Resolve the public IDs without ever printing or copying billing metadata.
  const sourceResponse = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['HMGET', `key:data:${hash}`, 'key_id', 'tenant_id']), cache: 'no-store' })
  if (!sourceResponse.ok) throw new Error('Could not resolve the staging key record.')
  const source = await sourceResponse.json() as { result?: [string | null, string | null] }
  const [keyId, tenantId] = source.result ?? []
  if (!keyId || !tenantId) throw new Error('The staging key record is missing its public identifiers.')
  body[5] = `${prefix}tenant:data:${tenantId}`
  body[6] = `${prefix}key:id:${keyId}`
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  if (!response.ok) throw new Error(`Upstash migration returned HTTP ${response.status}.`)
  const result = await response.json() as { result?: number; error?: string }
  if (result.error || result.result === -1) throw new Error('The legacy staging credential is missing or inactive.')
  console.log(result.result === 1 ? `Created isolated ${namespace} tenant for ${keyId}.` : `Isolated ${namespace} tenant already exists for ${keyId}; no changes made.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Preview Redis migration failed.'); process.exitCode = 1 })
