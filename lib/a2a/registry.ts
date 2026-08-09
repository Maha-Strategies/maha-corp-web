import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace.ts'
import { assertPublicUpstreamHost, parsePublicUpstreamUrl } from '../mcp-gateway.ts'
import { encryptSecret } from '../mcp/registry.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'
import { parseA2AAgentCard, parseA2APaymentPolicy, parseA2ATaskPolicy } from './validation.ts'
import type { A2AAgentConfig, A2AAgentSummary, A2AAuthType } from './types.ts'
import type { BuyerPolicy } from '../x402/buyer-policy.ts'

const redis = Redis.fromEnv()
const MAX_AGENT_CARD_BYTES = 256_000

function key(tenantId: string) {
  return scopedRedisKey(`a2a:tenant:${tenantId}:agents`)
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_AGENT_CARD_BYTES) throw new Error('Agent Card exceeds 256 KB.')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_AGENT_CARD_BYTES) throw new Error('Agent Card exceeds 256 KB.')
  try { return JSON.parse(text) } catch { throw new Error('Agent Card is not valid JSON.') }
}

export class A2ARegistry {
  static async registerAgent(tenantId: string, input: {
    name: string
    agentCardUrl: string
    authType: A2AAuthType
    rawSecret?: string
    taskPolicy: unknown
    paymentPolicy?: BuyerPolicy
  }, fetchImpl: typeof fetch = fetch): Promise<A2AAgentConfig> {
    const agentCardUrl = parsePublicUpstreamUrl(input.agentCardUrl)
    await assertPublicUpstreamHost(agentCardUrl)
    const response = await fetchImpl(agentCardUrl, {
      method: 'GET', headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok || response.status >= 300 && response.status < 400) throw new Error(`Agent Card returned HTTP ${response.status}.`)
    const agentCard = parseA2AAgentCard(await readBoundedJson(response))
    await assertPublicUpstreamHost(agentCard.rpcUrl)
    const taskPolicy = parseA2ATaskPolicy(input.taskPolicy, agentCard.skills.map((skill) => skill.id))
    const paymentPolicy = input.paymentPolicy ? parseA2APaymentPolicy(input.paymentPolicy, agentCard.rpcUrl) : undefined
    const config: A2AAgentConfig = {
      id: `a2a_agt_${crypto.randomBytes(8).toString('hex')}`,
      tenantId,
      name: input.name,
      agentCardUrl,
      rpcUrl: agentCard.rpcUrl,
      authType: input.authType,
      ...(input.rawSecret ? { authSecretEncrypted: encryptSecret(input.rawSecret) } : {}),
      status: 'active',
      taskPolicy,
      ...(paymentPolicy ? { paymentPolicy } : {}),
      agentCard,
      createdAt: Date.now(),
    }
    await traceRedisQuery('HSET', () => redis.hset(key(tenantId), { [config.id]: JSON.stringify(config) }))
    return config
  }

  static async getAgent(tenantId: string, agentId: string): Promise<A2AAgentConfig | null> {
    const raw = await traceRedisQuery('HGET', () => redis.hget<string | A2AAgentConfig>(key(tenantId), agentId))
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) as A2AAgentConfig : raw
  }

  static async listAgents(tenantId: string): Promise<A2AAgentConfig[]> {
    const rows = await traceRedisQuery('HGETALL', () => redis.hgetall<Record<string, string | A2AAgentConfig>>(key(tenantId)))
    if (!rows) return []
    return Object.values(rows).map((row) => typeof row === 'string' ? JSON.parse(row) as A2AAgentConfig : row)
  }

  static summarize(config: A2AAgentConfig): A2AAgentSummary {
    return {
      id: config.id,
      name: config.name,
      agentCardUrl: config.agentCardUrl,
      rpcUrl: config.rpcUrl,
      authType: config.authType,
      status: config.status,
      taskPolicy: config.taskPolicy,
      agentCard: config.agentCard,
      createdAt: config.createdAt,
      paymentPolicy: {
        configured: Boolean(config.paymentPolicy),
        ...(config.paymentPolicy ? { policyId: config.paymentPolicy.policyId, policyVersion: config.paymentPolicy.policyVersion } : {}),
      },
    }
  }
}
