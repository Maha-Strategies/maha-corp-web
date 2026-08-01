import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace'
import type { MCPSlaPolicy } from './types'
import { DEFAULT_MCP_SLA_POLICY, parseMcpSlaPolicy } from './validation'

const redis = Redis.fromEnv()

function policyKey(tenantId: string) {
  return scopedRedisKey(`mcp:tenant:${tenantId}:sla`)
}

function circuitKey(tenantId: string, serverId: string) {
  return scopedRedisKey(`mcp:tenant:${tenantId}:circuit:${serverId}`)
}

export class MCPControls {
  static async getPolicy(tenantId: string): Promise<MCPSlaPolicy> {
    const stored = await redis.get<string | MCPSlaPolicy>(policyKey(tenantId))
    if (!stored) return { ...DEFAULT_MCP_SLA_POLICY }
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
    return parseMcpSlaPolicy(parsed)
  }

  static async setPolicy(tenantId: string, value: unknown): Promise<MCPSlaPolicy> {
    const policy = parseMcpSlaPolicy(value)
    await redis.set(policyKey(tenantId), JSON.stringify(policy))
    return policy
  }

  static async consumeRateLimit(tenantId: string, limit: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    const bucket = Math.floor(Date.now() / 60_000)
    const key = scopedRedisKey(`mcp:tenant:${tenantId}:rate:${bucket}`)
    const script = `local current=redis.call('INCR',KEYS[1]); if current==1 then redis.call('EXPIRE',KEYS[1],60) end; local ttl=redis.call('TTL',KEYS[1]); if current>tonumber(ARGV[1]) then return {0,0,ttl} end; return {1,tonumber(ARGV[1])-current,ttl}`
    const result = await redis.eval(script, [key], [String(limit)]) as number[]
    return { allowed: result[0] === 1, remaining: result[1] ?? 0, retryAfterSeconds: Math.max(1, result[2] ?? 60) }
  }

  static async beforeRequest(tenantId: string, serverId: string, policy: MCPSlaPolicy): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now()
    const script = `local openUntil=tonumber(redis.call('HGET',KEYS[1],'open_until') or '0'); local failures=tonumber(redis.call('HGET',KEYS[1],'failures') or '0'); local probeUntil=tonumber(redis.call('HGET',KEYS[1],'probe_until') or '0'); if openUntil>tonumber(ARGV[1]) then return {0,openUntil-tonumber(ARGV[1])} end; if failures>=tonumber(ARGV[2]) then if probeUntil>tonumber(ARGV[1]) then return {0,probeUntil-tonumber(ARGV[1])} end; redis.call('HSET',KEYS[1],'probe_until',tonumber(ARGV[1])+tonumber(ARGV[3])); redis.call('PEXPIRE',KEYS[1],tonumber(ARGV[4])*2); end; return {1,0}`
    const result = await redis.eval(script, [circuitKey(tenantId, serverId)], [String(now), String(policy.failureThreshold), String(policy.timeoutMs), String(policy.cooldownMs)]) as number[]
    return { allowed: result[0] === 1, retryAfterSeconds: Math.max(1, Math.ceil((result[1] ?? 0) / 1_000)) }
  }

  static async recordSuccess(tenantId: string, serverId: string): Promise<void> {
    await redis.del(circuitKey(tenantId, serverId))
  }

  static async recordFailure(tenantId: string, serverId: string, policy: MCPSlaPolicy): Promise<void> {
    const now = Date.now()
    const script = `local failures=redis.call('HINCRBY',KEYS[1],'failures',1); redis.call('HDEL',KEYS[1],'probe_until'); if failures>=tonumber(ARGV[1]) then redis.call('HSET',KEYS[1],'open_until',tonumber(ARGV[2])+tonumber(ARGV[3])) end; redis.call('PEXPIRE',KEYS[1],tonumber(ARGV[3])*2); return failures`
    await redis.eval(script, [circuitKey(tenantId, serverId)], [String(policy.failureThreshold), String(now), String(policy.cooldownMs)])
  }
}
