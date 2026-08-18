import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'

const APPROVAL_TTL_SECONDS = 60 * 60 * 24
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

export const APPROVAL_ID_HEADER = 'X-Maha-Approval-ID'
export const APPROVAL_STATE_HEADER = 'X-Maha-Approval-State'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'consumed' | 'expired'
export type ApprovalRecord = {
  approvalId: string
  tenantId: string
  taskId: string
  actionSha256: string
  policySha256: string
  status: ApprovalStatus
  createdAt: string
  expiresAt: string
  decidedAt: string | null
  consumedAt: string | null
  reviewerSha256: string | null
  reasonCode: string | null
}

export interface ApprovalStore {
  request(input: Omit<ApprovalRecord, 'status' | 'createdAt' | 'decidedAt' | 'consumedAt' | 'reviewerSha256' | 'reasonCode'> & { createdAt?: string }): Promise<ApprovalRecord>
  decide(input: { tenantId: string; taskId: string; approvalId: string; decision: 'approve' | 'deny'; reviewerSha256: string; reasonCode: string; idempotencyKey: string; decidedAt?: string }): Promise<{ accepted: boolean; idempotent: boolean; record: ApprovalRecord | null }>
  consume(input: { tenantId: string; taskId: string; approvalId: string; actionSha256: string; policySha256: string; consumedAt?: string }): Promise<{ consumed: boolean; reason: 'missing' | 'not_approved' | 'expired' | 'binding_mismatch' | null; record: ApprovalRecord | null }>
  get(tenantId: string, taskId: string, approvalId: string): Promise<ApprovalRecord | null>
}

function assertId(value: string, label: string) { if (!ID.test(value)) throw new Error(`${label} is invalid.`) }
function assertDigest(value: string, label: string) { if (!SHA256.test(value)) throw new Error(`${label} is invalid.`) }
function digest(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex') }
function key(tenantId: string, taskId: string, approvalId: string) { return scopedRedisKey(`workflow:tenant:${digest(tenantId)}:task:${digest(taskId)}:approval:${digest(approvalId)}`) }
function decisionKey(tenantId: string, taskId: string, approvalId: string, idempotencyKey: string) { return scopedRedisKey(`workflow:tenant:${digest(tenantId)}:task:${digest(taskId)}:approval:${digest(approvalId)}:decision:${digest(idempotencyKey)}`) }

export function approvalIdFor(actionSha256: string, policySha256: string): string {
  assertDigest(actionSha256, 'actionSha256'); assertDigest(policySha256, 'policySha256')
  return `approval-${createHash('sha256').update(`${actionSha256}\n${policySha256}`).digest('hex')}`
}

function normalize(record: Record<string, unknown>): ApprovalRecord {
  return {
    approvalId: String(record.approval_id), tenantId: String(record.tenant_id), taskId: String(record.task_id),
    actionSha256: String(record.action_sha256), policySha256: String(record.policy_sha256), status: String(record.status) as ApprovalStatus,
    createdAt: String(record.created_at), expiresAt: String(record.expires_at), decidedAt: record.decided_at ? String(record.decided_at) : null,
    consumedAt: record.consumed_at ? String(record.consumed_at) : null, reviewerSha256: record.reviewer_sha256 ? String(record.reviewer_sha256) : null,
    reasonCode: record.reason_code ? String(record.reason_code) : null,
  }
}

const REQUEST_LUA = `
if redis.call('EXISTS',KEYS[1])==0 then
 redis.call('HSET',KEYS[1],'approval_id',ARGV[1],'tenant_id',ARGV[2],'task_id',ARGV[3],'action_sha256',ARGV[4],'policy_sha256',ARGV[5],'status','pending','created_at',ARGV[6],'expires_at',ARGV[7],'expires_at_ms',ARGV[8],'decided_at','','consumed_at','','reviewer_sha256','','reason_code','')
 redis.call('EXPIRE',KEYS[1],ARGV[9])
end
return redis.call('HGETALL',KEYS[1])
`
const DECIDE_LUA = `
if redis.call('EXISTS',KEYS[2])==1 then return {2} end
if redis.call('EXISTS',KEYS[1])==0 then return {0} end
local status=redis.call('HGET',KEYS[1],'status')
if status~='pending' then return {0} end
local next=ARGV[1]=='approve' and 'approved' or 'denied'
redis.call('HSET',KEYS[1],'status',next,'decided_at',ARGV[2],'reviewer_sha256',ARGV[3],'reason_code',ARGV[4])
redis.call('SET',KEYS[2],redis.call('HGET',KEYS[1],'approval_id'),'EX',ARGV[5])
return {1}
`
const CONSUME_LUA = `
if redis.call('EXISTS',KEYS[1])==0 then return {'missing'} end
if redis.call('HGET',KEYS[1],'action_sha256')~=ARGV[1] or redis.call('HGET',KEYS[1],'policy_sha256')~=ARGV[2] then return {'binding_mismatch'} end
if tonumber(redis.call('HGET',KEYS[1],'expires_at_ms')) and tonumber(redis.call('HGET',KEYS[1],'expires_at_ms'))<=tonumber(ARGV[4]) then redis.call('HSET',KEYS[1],'status','expired'); return {'expired'} end
if redis.call('HGET',KEYS[1],'status')~='approved' then return {'not_approved'} end
redis.call('HSET',KEYS[1],'status','consumed','consumed_at',ARGV[3])
return {'consumed'}
`

const redis = Redis.fromEnv()
export class UpstashApprovalStore implements ApprovalStore {
  async request(input: Parameters<ApprovalStore['request']>[0]): Promise<ApprovalRecord> {
    validateRequest(input)
    const createdAt = input.createdAt ?? new Date().toISOString()
    const ttl = Math.max(1, Math.min(APPROVAL_TTL_SECONDS, Math.ceil((Date.parse(input.expiresAt) - Date.parse(createdAt)) / 1000)))
    const raw = await traceRedisQuery('EVAL', () => redis.eval(REQUEST_LUA, [key(input.tenantId, input.taskId, input.approvalId)], [input.approvalId, input.tenantId, input.taskId, input.actionSha256, input.policySha256, createdAt, input.expiresAt, String(Date.parse(input.expiresAt)), String(ttl)]))
    const values = Array.isArray(raw) ? Object.fromEntries(Array.from({ length: raw.length / 2 }, (_, i) => [String(raw[i * 2]), raw[i * 2 + 1]])) : raw as Record<string, unknown>
    return normalize(values)
  }
  async decide(input: Parameters<ApprovalStore['decide']>[0]) {
    validateDecision(input)
    const decidedAt = input.decidedAt ?? new Date().toISOString()
    const result = await traceRedisQuery('EVAL', () => redis.eval(DECIDE_LUA, [key(input.tenantId, input.taskId, input.approvalId), decisionKey(input.tenantId, input.taskId, input.approvalId, input.idempotencyKey)], [input.decision, decidedAt, input.reviewerSha256, input.reasonCode, String(APPROVAL_TTL_SECONDS)])) as Array<string | number>
    return { accepted: Number(result[0]) > 0, idempotent: Number(result[0]) === 2, record: await this.get(input.tenantId, input.taskId, input.approvalId) }
  }
  async consume(input: Parameters<ApprovalStore['consume']>[0]) {
    validateConsume(input)
    const consumedAt = input.consumedAt ?? new Date().toISOString()
    const result = await traceRedisQuery('EVAL', () => redis.eval(CONSUME_LUA, [key(input.tenantId, input.taskId, input.approvalId)], [input.actionSha256, input.policySha256, consumedAt, String(Date.parse(consumedAt))])) as string[]
    const code = String(result[0]) as 'consumed' | 'missing' | 'not_approved' | 'expired' | 'binding_mismatch'
    return { consumed: code === 'consumed', reason: code === 'consumed' ? null : code, record: await this.get(input.tenantId, input.taskId, input.approvalId) }
  }
  async get(tenantId: string, taskId: string, approvalId: string) {
    assertId(tenantId, 'tenantId'); assertId(taskId, 'taskId'); assertId(approvalId, 'approvalId')
    const values = await traceRedisQuery('HGETALL', () => redis.hgetall<Record<string, unknown>>(key(tenantId, taskId, approvalId)))
    return values && Object.keys(values).length ? normalize(values) : null
  }
}

function validateRequest(input: Parameters<ApprovalStore['request']>[0]) {
  assertId(input.tenantId, 'tenantId'); assertId(input.taskId, 'taskId'); assertId(input.approvalId, 'approvalId')
  assertDigest(input.actionSha256, 'actionSha256'); assertDigest(input.policySha256, 'policySha256')
  if (!Number.isFinite(Date.parse(input.expiresAt))) throw new Error('expiresAt is invalid.')
}
function validateDecision(input: Parameters<ApprovalStore['decide']>[0]) {
  assertId(input.tenantId, 'tenantId'); assertId(input.taskId, 'taskId'); assertId(input.approvalId, 'approvalId'); assertId(input.idempotencyKey, 'idempotencyKey')
  assertDigest(input.reviewerSha256, 'reviewerSha256'); if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,79}$/.test(input.reasonCode)) throw new Error('reasonCode is invalid.')
}
function validateConsume(input: Parameters<ApprovalStore['consume']>[0]) { assertId(input.tenantId, 'tenantId'); assertId(input.taskId, 'taskId'); assertId(input.approvalId, 'approvalId'); assertDigest(input.actionSha256, 'actionSha256'); assertDigest(input.policySha256, 'policySha256') }

export class MemoryApprovalStore implements ApprovalStore {
  private records = new Map<string, ApprovalRecord>(); private decisions = new Set<string>()
  private k(t: string, task: string, a: string) { return `${t}\n${task}\n${a}` }
  async request(input: Parameters<ApprovalStore['request']>[0]) { validateRequest(input); const k = this.k(input.tenantId, input.taskId, input.approvalId); const existing = this.records.get(k); if (existing) return { ...existing }; const createdAt = input.createdAt ?? new Date().toISOString(); const record: ApprovalRecord = { ...input, createdAt, status: 'pending', decidedAt: null, consumedAt: null, reviewerSha256: null, reasonCode: null }; this.records.set(k, record); return { ...record } }
  async decide(input: Parameters<ApprovalStore['decide']>[0]) { validateDecision(input); const replay = `${input.tenantId}\n${input.taskId}\n${input.approvalId}\n${input.idempotencyKey}`; const record = this.records.get(this.k(input.tenantId, input.taskId, input.approvalId)) ?? null; if (this.decisions.has(replay)) return { accepted: true, idempotent: true, record: record ? { ...record } : null }; if (!record || record.status !== 'pending') return { accepted: false, idempotent: false, record: record ? { ...record } : null }; record.status = input.decision === 'approve' ? 'approved' : 'denied'; record.decidedAt = input.decidedAt ?? new Date().toISOString(); record.reviewerSha256 = input.reviewerSha256; record.reasonCode = input.reasonCode; this.decisions.add(replay); return { accepted: true, idempotent: false, record: { ...record } } }
  async consume(input: Parameters<ApprovalStore['consume']>[0]) { validateConsume(input); const record = this.records.get(this.k(input.tenantId, input.taskId, input.approvalId)) ?? null; let reason: 'missing' | 'not_approved' | 'expired' | 'binding_mismatch' | null = null; if (!record) reason = 'missing'; else if (record.actionSha256 !== input.actionSha256 || record.policySha256 !== input.policySha256) reason = 'binding_mismatch'; else if (Date.parse(record.expiresAt) <= Date.parse(input.consumedAt ?? new Date().toISOString())) { record.status = 'expired'; reason = 'expired' } else if (record.status !== 'approved') reason = 'not_approved'; else { record.status = 'consumed'; record.consumedAt = input.consumedAt ?? new Date().toISOString() } return { consumed: reason === null, reason, record: record ? { ...record } : null } }
  async get(tenantId: string, taskId: string, approvalId: string) { const record = this.records.get(this.k(tenantId, taskId, approvalId)); return record ? { ...record } : null }
}
