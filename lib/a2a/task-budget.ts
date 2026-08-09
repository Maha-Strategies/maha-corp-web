import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'
import type { A2AJsonRpcRequest } from './types.ts'

const TASK_BUDGET_TTL_SECONDS = 60 * 60 * 24 * 30

export type A2ATaskBudgetState = {
  taskId: string
  cumulativeSpentBaseUnits: string
  reservedBaseUnits: string
  maxTaskBudgetBaseUnits: string
  status: 'active' | 'closed'
}

export type A2ATaskBudgetReservation = {
  tenantId: string
  agentId: string
  taskId: string
  authorizationId: string
  network: string
  asset: string
  amount: string
  maxTaskBudget: string
}

export interface A2ATaskBudgetStore {
  canReserve(input: Omit<A2ATaskBudgetReservation, 'authorizationId'>): Promise<{ allowed: boolean; state: A2ATaskBudgetState }>
  reserve(input: A2ATaskBudgetReservation): Promise<{ reserved: boolean; reason?: 'authorization_replayed' | 'task_budget_exceeded' | 'task_closed' | 'task_payment_rail_mismatch'; state: A2ATaskBudgetState }>
  cancel(input: Pick<A2ATaskBudgetReservation, 'tenantId' | 'agentId' | 'taskId' | 'authorizationId'>): Promise<void>
  settle(input: Pick<A2ATaskBudgetReservation, 'tenantId' | 'agentId' | 'taskId' | 'authorizationId'> & { transaction: string }): Promise<{ settled: boolean; reason?: 'reservation_missing' | 'settlement_replayed'; state: A2ATaskBudgetState }>
  bindUpstreamTask(input: { tenantId: string; agentId: string; taskId: string; upstreamTaskId: string }): Promise<void>
  resolveTaskId(input: { tenantId: string; agentId: string; taskId: string }): Promise<string>
}

function boundedInteger(value: string, label: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error(`${label} must be a non-negative integer.`)
  const parsed = BigInt(value)
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the durable ledger's exact integer range.`)
  return parsed
}

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function budgetKey(tenantId: string, agentId: string, taskId: string): string {
  return scopedRedisKey(`a2a:tenant:${tenantId}:agent:${agentId}:task-budget:${digest(taskId)}`)
}

function aliasKey(tenantId: string, agentId: string, taskId: string): string {
  return scopedRedisKey(`a2a:tenant:${tenantId}:agent:${agentId}:task-alias:${digest(taskId)}`)
}

function authorizationKey(tenantId: string, agentId: string, authorizationId: string): string {
  return scopedRedisKey(`a2a:tenant:${tenantId}:agent:${agentId}:task-authorization:${digest(authorizationId)}`)
}

function settlementKey(tenantId: string, transaction: string): string {
  return scopedRedisKey(`a2a:tenant:${tenantId}:a2a-settlement:${transaction.toLowerCase()}`)
}

function state(taskId: string, values: Array<string | number>): A2ATaskBudgetState {
  return {
    taskId,
    cumulativeSpentBaseUnits: String(values[0] ?? '0'),
    reservedBaseUnits: String(values[1] ?? '0'),
    maxTaskBudgetBaseUnits: String(values[2] ?? '0'),
    status: Number(values[3] ?? 0) === 1 ? 'closed' : 'active',
  }
}

function messageIdentity(request: A2AJsonRpcRequest): string | null {
  const message = request.params?.message
  if (typeof message !== 'object' || message === null || Array.isArray(message)) return null
  const record = message as Record<string, unknown>
  if (typeof record.contextId === 'string' && record.contextId.length > 0) return record.contextId
  return typeof record.messageId === 'string' && record.messageId.length > 0 ? record.messageId : null
}

/**
 * Returns a stable gateway task identity before an upstream task exists. Once
 * message/send returns the upstream task id, bindUpstreamTask aliases that id
 * to this same ledger so tasks/get and tasks/cancel share the budget.
 */
export function a2aTaskIdForExternal(value: string): string {
  return `a2a-task-${digest(value).slice(0, 32)}`
}

export function a2aTaskId(request: A2AJsonRpcRequest): string {
  const explicit = typeof request.params?.id === 'string' && request.params.id.length > 0 ? request.params.id : null
  const source = explicit ?? messageIdentity(request) ?? String(request.id)
  return a2aTaskIdForExternal(source)
}

export function a2aUpstreamTaskId(response: unknown): string | null {
  if (typeof response !== 'object' || response === null || Array.isArray(response)) return null
  const result = (response as Record<string, unknown>).result
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return null
  const id = (result as Record<string, unknown>).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function maxTaskBudgetFor(network: string, asset: string, rules: Array<{ network: string; asset: string; maxAmountPerTask: string }>): string | null {
  const match = rules.find((rule) => rule.network === network && rule.asset.toLowerCase() === asset.toLowerCase())
  return match?.maxAmountPerTask ?? null
}

const redis = Redis.fromEnv()

export class UpstashA2ATaskBudgetStore implements A2ATaskBudgetStore {
  async resolveTaskId(input: { tenantId: string; agentId: string; taskId: string }): Promise<string> {
    const canonical = await traceRedisQuery('GET', () => redis.get<string>(aliasKey(input.tenantId, input.agentId, input.taskId)))
    return canonical ?? input.taskId
  }

  async canReserve(input: Omit<A2ATaskBudgetReservation, 'authorizationId'>): Promise<{ allowed: boolean; state: A2ATaskBudgetState }> {
    const amount = boundedInteger(input.amount, 'amount')
    const max = boundedInteger(input.maxTaskBudget, 'maxTaskBudget')
    const taskId = await this.resolveTaskId(input)
    const values = await traceRedisQuery('EVAL', () => redis.eval(
      `local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); local configured=tonumber(redis.call('HGET',KEYS[1],'max_budget') or ARGV[2]); local closed=redis.call('HGET',KEYS[1],'status')=='closed'; local network=redis.call('HGET',KEYS[1],'network'); local asset=redis.call('HGET',KEYS[1],'asset'); if (network and network~=ARGV[3]) or (asset and string.lower(asset)~=string.lower(ARGV[4])) then return {0,spent,reserved,configured,closed and 1 or 0} end; if configured~=tonumber(ARGV[2]) then return {0,spent,reserved,configured,closed and 1 or 0} end; if closed or spent+reserved+tonumber(ARGV[1])>configured then return {0,spent,reserved,configured,closed and 1 or 0} end; return {1,spent,reserved,configured,0}`,
      [budgetKey(input.tenantId, input.agentId, taskId)], [amount.toString(), max.toString(), input.network, input.asset],
    )) as Array<string | number>
    return { allowed: Number(values[0]) === 1, state: state(taskId, values.slice(1)) }
  }

  async reserve(input: A2ATaskBudgetReservation): Promise<{ reserved: boolean; reason?: 'authorization_replayed' | 'task_budget_exceeded' | 'task_closed' | 'task_payment_rail_mismatch'; state: A2ATaskBudgetState }> {
    const amount = boundedInteger(input.amount, 'amount')
    const max = boundedInteger(input.maxTaskBudget, 'maxTaskBudget')
    if (amount <= BigInt(0) || max <= BigInt(0)) throw new Error('Task budget amounts must be positive.')
    const taskId = await this.resolveTaskId(input)
    const values = await traceRedisQuery('EVAL', () => redis.eval(
      `if redis.call('EXISTS',KEYS[2])==1 then local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); local max=tonumber(redis.call('HGET',KEYS[1],'max_budget') or ARGV[2]); return {-1,spent,reserved,max,redis.call('HGET',KEYS[1],'status')=='closed' and 1 or 0} end; local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); local configured=tonumber(redis.call('HGET',KEYS[1],'max_budget') or ARGV[2]); local closed=redis.call('HGET',KEYS[1],'status')=='closed'; local network=redis.call('HGET',KEYS[1],'network'); local asset=redis.call('HGET',KEYS[1],'asset'); if (network and network~=ARGV[4]) or (asset and string.lower(asset)~=string.lower(ARGV[5])) then return {-3,spent,reserved,configured,closed and 1 or 0} end; if closed then return {-2,spent,reserved,configured,1} end; if configured~=tonumber(ARGV[2]) or spent+reserved+tonumber(ARGV[1])>configured then return {0,spent,reserved,configured,0} end; redis.call('HSET',KEYS[1],'task_id',ARGV[3],'network',ARGV[4],'asset',ARGV[5],'cumulative_spent',spent,'reserved',reserved+tonumber(ARGV[1]),'max_budget',configured,'status','active','updated_at',ARGV[6]); redis.call('EXPIRE',KEYS[1],ARGV[7]); redis.call('HSET',KEYS[2],'task_id',ARGV[3],'amount',ARGV[1],'status','reserved','created_at',ARGV[6]); redis.call('EXPIRE',KEYS[2],ARGV[7]); return {1,spent,reserved+tonumber(ARGV[1]),configured,0}`,
      [budgetKey(input.tenantId, input.agentId, taskId), authorizationKey(input.tenantId, input.agentId, input.authorizationId)],
      [amount.toString(), max.toString(), taskId, input.network, input.asset, new Date().toISOString(), String(TASK_BUDGET_TTL_SECONDS)],
    )) as Array<string | number>
    const code = Number(values[0])
    return {
      reserved: code === 1,
      ...(code === -1 ? { reason: 'authorization_replayed' as const } : code === -2 ? { reason: 'task_closed' as const } : code === -3 ? { reason: 'task_payment_rail_mismatch' as const } : code === 0 ? { reason: 'task_budget_exceeded' as const } : {}),
      state: state(taskId, values.slice(1)),
    }
  }

  async cancel(input: Pick<A2ATaskBudgetReservation, 'tenantId' | 'agentId' | 'taskId' | 'authorizationId'>): Promise<void> {
    const taskId = await this.resolveTaskId(input)
    await traceRedisQuery('EVAL', () => redis.eval(
      `if redis.call('HGET',KEYS[2],'status')~='reserved' then return 0 end; local amount=tonumber(redis.call('HGET',KEYS[2],'amount') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); redis.call('HSET',KEYS[1],'reserved',math.max(0,reserved-amount),'updated_at',ARGV[1]); redis.call('HSET',KEYS[2],'status','cancelled','updated_at',ARGV[1]); return 1`,
      [budgetKey(input.tenantId, input.agentId, taskId), authorizationKey(input.tenantId, input.agentId, input.authorizationId)], [new Date().toISOString()],
    ))
  }

  async settle(input: Pick<A2ATaskBudgetReservation, 'tenantId' | 'agentId' | 'taskId' | 'authorizationId'> & { transaction: string }): Promise<{ settled: boolean; reason?: 'reservation_missing' | 'settlement_replayed'; state: A2ATaskBudgetState }> {
    const taskId = await this.resolveTaskId(input)
    const values = await traceRedisQuery('EVAL', () => redis.eval(
      `if redis.call('EXISTS',KEYS[3])==1 then local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); local max=tonumber(redis.call('HGET',KEYS[1],'max_budget') or '0'); return {-1,spent,reserved,max,redis.call('HGET',KEYS[1],'status')=='closed' and 1 or 0} end; if redis.call('HGET',KEYS[2],'status')~='reserved' then local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0'); local reserved=tonumber(redis.call('HGET',KEYS[1],'reserved') or '0'); local max=tonumber(redis.call('HGET',KEYS[1],'max_budget') or '0'); return {0,spent,reserved,max,redis.call('HGET',KEYS[1],'status')=='closed' and 1 or 0} end; local amount=tonumber(redis.call('HGET',KEYS[2],'amount') or '0'); local spent=tonumber(redis.call('HGET',KEYS[1],'cumulative_spent') or '0')+amount; local reserved=math.max(0,tonumber(redis.call('HGET',KEYS[1],'reserved') or '0')-amount); local max=tonumber(redis.call('HGET',KEYS[1],'max_budget') or '0'); local status=spent>=max and 'closed' or 'active'; redis.call('HSET',KEYS[1],'cumulative_spent',spent,'reserved',reserved,'status',status,'updated_at',ARGV[2]); redis.call('HSET',KEYS[2],'status','settled','transaction',ARGV[1],'updated_at',ARGV[2]); redis.call('SET',KEYS[3],ARGV[3],'EX',ARGV[4]); return {1,spent,reserved,max,status=='closed' and 1 or 0}`,
      [budgetKey(input.tenantId, input.agentId, taskId), authorizationKey(input.tenantId, input.agentId, input.authorizationId), settlementKey(input.tenantId, input.transaction)],
      [input.transaction.toLowerCase(), new Date().toISOString(), input.authorizationId, String(TASK_BUDGET_TTL_SECONDS)],
    )) as Array<string | number>
    const code = Number(values[0])
    return { settled: code === 1, ...(code === -1 ? { reason: 'settlement_replayed' as const } : code === 0 ? { reason: 'reservation_missing' as const } : {}), state: state(taskId, values.slice(1)) }
  }

  async bindUpstreamTask(input: { tenantId: string; agentId: string; taskId: string; upstreamTaskId: string }): Promise<void> {
    const canonical = await this.resolveTaskId(input)
    const result = await traceRedisQuery('EVAL', () => redis.eval(
      `local existing=redis.call('GET',KEYS[1]); if existing and existing~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); return 1`,
      [aliasKey(input.tenantId, input.agentId, input.upstreamTaskId)], [canonical, String(TASK_BUDGET_TTL_SECONDS)],
    )) as number
    if (result !== 1) throw new Error('The upstream A2A task is already bound to another budget ledger.')
  }
}
