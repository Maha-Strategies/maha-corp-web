import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'

const TTL_SECONDS = 60 * 60 * 24 * 30
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/
export const RECOVERY_ACTION_HEADER = 'X-Maha-Action-ID'
export const RECOVERY_STATE_HEADER = 'X-Maha-Recovery-State'
export const RECOVERY_EVIDENCE_HEADER = 'X-Maha-Recovery-Evidence'

export type RecoveryStatus = 'claimed' | 'awaiting_payment' | 'succeeded' | 'failed' | 'indeterminate'
export type RecoveryRecord = { tenantId: string; taskId: string; actionId: string; actionSha256: string; policySha256: string; status: RecoveryStatus; claimedAt: string; completedAt: string | null; responseStatus: number | null; responseSha256: string | null; upstreamReferenceSha256: string | null }
export interface RecoveryStore {
  claim(input: Omit<RecoveryRecord, 'status' | 'claimedAt' | 'completedAt' | 'responseStatus' | 'responseSha256' | 'upstreamReferenceSha256'> & { claimedAt?: string }): Promise<{ execute: boolean; record: RecoveryRecord }>
  finish(input: { tenantId: string; taskId: string; actionId: string; status: Exclude<RecoveryStatus, 'claimed'>; responseStatus: number | null; responseSha256: string | null; upstreamReferenceSha256?: string | null; completedAt?: string }): Promise<RecoveryRecord>
  get(tenantId: string, taskId: string, actionId: string): Promise<RecoveryRecord | null>
}
function assertId(v: string, l: string) { if (!ID.test(v)) throw new Error(`${l} is invalid.`) }
function assertDigest(v: string, l: string) { if (!SHA256.test(v)) throw new Error(`${l} is invalid.`) }
function digest(v: string) { return createHash('sha256').update(v).digest('hex') }
function key(t: string, task: string, action: string) { return scopedRedisKey(`workflow:tenant:${digest(t)}:task:${digest(task)}:action:${digest(action)}`) }
export function workflowActionIdForExternal(value: string): string { if (!ID.test(value)) throw new Error('External action ID is invalid.'); return `workflow-action-${digest(value).slice(0, 32)}` }
function normalize(v: Record<string, unknown>): RecoveryRecord { return { tenantId: String(v.tenant_id), taskId: String(v.task_id), actionId: String(v.action_id), actionSha256: String(v.action_sha256), policySha256: String(v.policy_sha256), status: String(v.status) as RecoveryStatus, claimedAt: String(v.claimed_at), completedAt: v.completed_at ? String(v.completed_at) : null, responseStatus: v.response_status === '' || v.response_status == null ? null : Number(v.response_status), responseSha256: v.response_sha256 ? String(v.response_sha256) : null, upstreamReferenceSha256: v.upstream_reference_sha256 ? String(v.upstream_reference_sha256) : null } }
const CLAIM_LUA = `if redis.call('EXISTS',KEYS[1])==1 then return {0} end redis.call('HSET',KEYS[1],'tenant_id',ARGV[1],'task_id',ARGV[2],'action_id',ARGV[3],'action_sha256',ARGV[4],'policy_sha256',ARGV[5],'status','claimed','claimed_at',ARGV[6],'completed_at','','response_status','','response_sha256','','upstream_reference_sha256',''); redis.call('EXPIRE',KEYS[1],ARGV[7]); return {1}`
const FINISH_LUA = `if redis.call('EXISTS',KEYS[1])==0 then return {0} end if redis.call('HGET',KEYS[1],'status')~='claimed' then return {2} end redis.call('HSET',KEYS[1],'status',ARGV[1],'completed_at',ARGV[2],'response_status',ARGV[3],'response_sha256',ARGV[4],'upstream_reference_sha256',ARGV[5]); return {1}`
const redis = Redis.fromEnv()
function validateBase(i: { tenantId: string; taskId: string; actionId: string }) { assertId(i.tenantId, 'tenantId'); assertId(i.taskId, 'taskId'); assertId(i.actionId, 'actionId') }
export class UpstashRecoveryStore implements RecoveryStore {
  async claim(input: Parameters<RecoveryStore['claim']>[0]) { validateBase(input); assertDigest(input.actionSha256, 'actionSha256'); assertDigest(input.policySha256, 'policySha256'); const claimedAt = input.claimedAt ?? new Date().toISOString(); const k = key(input.tenantId, input.taskId, input.actionId); const result = await traceRedisQuery('EVAL', () => redis.eval(CLAIM_LUA, [k], [input.tenantId, input.taskId, input.actionId, input.actionSha256, input.policySha256, claimedAt, String(TTL_SECONDS)])) as Array<number>; const record = await this.get(input.tenantId, input.taskId, input.actionId); if (!record) throw new Error('Recovery claim was not durably recorded.'); if (record.actionSha256 !== input.actionSha256 || record.policySha256 !== input.policySha256) return { execute: false, record }; return { execute: Number(result[0]) === 1, record } }
  async finish(input: Parameters<RecoveryStore['finish']>[0]) { validateBase(input); if (input.responseSha256) assertDigest(input.responseSha256, 'responseSha256'); if (input.upstreamReferenceSha256) assertDigest(input.upstreamReferenceSha256, 'upstreamReferenceSha256'); const completedAt = input.completedAt ?? new Date().toISOString(); const result = await traceRedisQuery('EVAL', () => redis.eval(FINISH_LUA, [key(input.tenantId, input.taskId, input.actionId)], [input.status, completedAt, input.responseStatus == null ? '' : String(input.responseStatus), input.responseSha256 ?? '', input.upstreamReferenceSha256 ?? ''])) as Array<number>; if (Number(result[0]) === 0) throw new Error('Recovery claim is missing.'); const record = await this.get(input.tenantId, input.taskId, input.actionId); if (!record) throw new Error('Recovery outcome was not durably recorded.'); return record }
  async get(t: string, task: string, a: string) { validateBase({ tenantId: t, taskId: task, actionId: a }); const v = await traceRedisQuery('HGETALL', () => redis.hgetall<Record<string, unknown>>(key(t, task, a))); return v && Object.keys(v).length ? normalize(v) : null }
}
export class MemoryRecoveryStore implements RecoveryStore {
  private records = new Map<string, RecoveryRecord>(); private k(t: string, task: string, a: string) { return `${t}\n${task}\n${a}` }
  async claim(input: Parameters<RecoveryStore['claim']>[0]) { validateBase(input); assertDigest(input.actionSha256, 'actionSha256'); assertDigest(input.policySha256, 'policySha256'); const k = this.k(input.tenantId, input.taskId, input.actionId); const existing = this.records.get(k); if (existing) return { execute: false, record: { ...existing } }; const record: RecoveryRecord = { ...input, status: 'claimed', claimedAt: input.claimedAt ?? new Date().toISOString(), completedAt: null, responseStatus: null, responseSha256: null, upstreamReferenceSha256: null }; this.records.set(k, record); return { execute: true, record: { ...record } } }
  async finish(input: Parameters<RecoveryStore['finish']>[0]) { validateBase(input); const record = this.records.get(this.k(input.tenantId, input.taskId, input.actionId)); if (!record) throw new Error('Recovery claim is missing.'); if (record.status === 'claimed') { record.status = input.status; record.completedAt = input.completedAt ?? new Date().toISOString(); record.responseStatus = input.responseStatus; record.responseSha256 = input.responseSha256; record.upstreamReferenceSha256 = input.upstreamReferenceSha256 ?? null } return { ...record } }
  async get(t: string, task: string, a: string) { const r = this.records.get(this.k(t, task, a)); return r ? { ...r } : null }
}

export function recoveryResponseHeaders(record: RecoveryRecord) { return { [RECOVERY_ACTION_HEADER]: record.actionId, [RECOVERY_STATE_HEADER]: record.status, ...(record.responseSha256 ? { [RECOVERY_EVIDENCE_HEADER]: record.responseSha256 } : {}) } }
