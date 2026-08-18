import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'
import { scopedRedisKey } from '../redis-namespace.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'

const WORKFLOW_TTL_SECONDS = 60 * 60 * 24 * 30
const MAX_RETAINED_EVENTS = 200
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

export const WORKFLOW_STATE_HEADER = 'X-Maha-Workflow-State'
export const WORKFLOW_VERSION_HEADER = 'X-Maha-Workflow-Version'

export type WorkflowTaskStatus =
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'awaiting_review'
  | 'awaiting_payment'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type WorkflowTransitionEvent =
  | 'action_dispatched'
  | 'action_succeeded'
  | 'action_failed'
  | 'action_denied'
  | 'participant_completed'
  | 'participant_failed'
  | 'participant_cancelled'
  | 'input_required'
  | 'input_received'
  | 'review_required'
  | 'review_approved'
  | 'payment_required'
  | 'payment_authorized'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'

export type WorkflowActor = {
  transport: 'a2a' | 'mcp' | 'orchestrator'
  targetId: string
  operation: string
}

export type WorkflowTransitionInput = {
  tenantId: string
  taskId: string
  transitionId: string
  event: WorkflowTransitionEvent
  actor: WorkflowActor
  evidenceSha256: string
  occurredAt?: string
}

export type WorkflowTaskState = {
  tenantId: string
  taskId: string
  status: WorkflowTaskStatus
  version: number
  createdAt: string
  updatedAt: string
  terminalAt: string | null
  lastTransitionId: string
  lastEvent: WorkflowTransitionEvent
  lastActor: WorkflowActor
  lastEvidenceSha256: string
}

export type WorkflowTaskEvent = {
  version: number
  transitionId: string
  event: WorkflowTransitionEvent
  from: WorkflowTaskStatus
  to: WorkflowTaskStatus
  occurredAt: string
  actor: WorkflowActor
  evidenceSha256: string
}

export type WorkflowTransitionResult = {
  accepted: boolean
  idempotent: boolean
  reason?: 'invalid_transition'
  state: WorkflowTaskState
}

export interface WorkflowTaskStore {
  transition(input: WorkflowTransitionInput): Promise<WorkflowTransitionResult>
  get(tenantId: string, taskId: string): Promise<WorkflowTaskState | null>
  events(tenantId: string, taskId: string): Promise<WorkflowTaskEvent[]>
}

const TERMINAL = new Set<WorkflowTaskStatus>(['completed', 'failed', 'cancelled'])

const TRANSITIONS: Record<WorkflowTaskStatus, Partial<Record<WorkflowTransitionEvent, WorkflowTaskStatus>>> = {
  pending: {
    action_dispatched: 'running', action_denied: 'pending', input_required: 'awaiting_input', review_required: 'awaiting_review',
    payment_required: 'awaiting_payment', payment_authorized: 'running', task_failed: 'failed', task_cancelled: 'cancelled',
  },
  running: {
    action_dispatched: 'running', action_succeeded: 'running', action_failed: 'running', action_denied: 'running',
    participant_completed: 'running', participant_failed: 'running', participant_cancelled: 'running',
    input_required: 'awaiting_input', review_required: 'awaiting_review', payment_required: 'awaiting_payment',
    payment_authorized: 'running', task_completed: 'completed', task_failed: 'failed', task_cancelled: 'cancelled',
  },
  awaiting_input: { input_received: 'running', action_denied: 'awaiting_input', task_failed: 'failed', task_cancelled: 'cancelled' },
  awaiting_review: { review_approved: 'running', action_denied: 'awaiting_review', task_failed: 'failed', task_cancelled: 'cancelled' },
  awaiting_payment: { payment_authorized: 'running', action_denied: 'awaiting_payment', task_failed: 'failed', task_cancelled: 'cancelled' },
  completed: {}, failed: {}, cancelled: {},
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} is invalid.`)
}

function assertTransition(input: WorkflowTransitionInput): void {
  assertIdentifier(input.tenantId, 'tenantId')
  assertIdentifier(input.taskId, 'taskId')
  assertIdentifier(input.transitionId, 'transitionId')
  assertIdentifier(input.actor.targetId, 'actor.targetId')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(input.actor.operation)) throw new Error('actor.operation is invalid.')
  if (!SHA256.test(input.evidenceSha256)) throw new Error('evidenceSha256 is invalid.')
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) throw new Error('occurredAt is invalid.')
}

export function nextWorkflowStatus(status: WorkflowTaskStatus, event: WorkflowTransitionEvent): WorkflowTaskStatus | null {
  return TRANSITIONS[status][event] ?? null
}

export function workflowTransitionId(parts: {
  taskId: string
  requestId: string | number
  targetId: string
  operation: string
  event: WorkflowTransitionEvent
}): string {
  const value = [parts.taskId, String(parts.requestId), parts.targetId, parts.operation, parts.event].join('\n')
  return `workflow-transition-${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`
}

export function workflowTaskIdForExternal(value: string): string {
  return `workflow-task-${crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32)}`
}

export function workflowResponseHeaders(state: WorkflowTaskState): Record<string, string> {
  return { [WORKFLOW_STATE_HEADER]: state.status, [WORKFLOW_VERSION_HEADER]: String(state.version) }
}

function digest(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function taskKey(tenantId: string, taskId: string): string {
  return scopedRedisKey(`workflow:tenant:${digest(tenantId)}:task:${digest(taskId)}:state`)
}

function eventsKey(tenantId: string, taskId: string): string {
  return scopedRedisKey(`workflow:tenant:${digest(tenantId)}:task:${digest(taskId)}:events`)
}

function transitionKey(tenantId: string, taskId: string, transitionId: string): string {
  return scopedRedisKey(`workflow:tenant:${digest(tenantId)}:task:${digest(taskId)}:transition:${digest(transitionId)}`)
}

function parseActor(value: unknown): WorkflowActor {
  if (typeof value === 'string') return JSON.parse(value) as WorkflowActor
  return value as WorkflowActor
}

function parseState(values: Record<string, unknown>): WorkflowTaskState {
  return {
    tenantId: String(values.tenant_id), taskId: String(values.task_id), status: String(values.status) as WorkflowTaskStatus,
    version: Number(values.version), createdAt: String(values.created_at), updatedAt: String(values.updated_at),
    terminalAt: values.terminal_at ? String(values.terminal_at) : null, lastTransitionId: String(values.last_transition_id),
    lastEvent: String(values.last_event) as WorkflowTransitionEvent, lastActor: parseActor(values.last_actor),
    lastEvidenceSha256: String(values.last_evidence_sha256),
  }
}

function pendingState(input: WorkflowTransitionInput, occurredAt: string): WorkflowTaskState {
  return {
    tenantId: input.tenantId, taskId: input.taskId, status: 'pending', version: 0, createdAt: occurredAt, updatedAt: occurredAt,
    terminalAt: null, lastTransitionId: '', lastEvent: input.event, lastActor: { ...input.actor }, lastEvidenceSha256: input.evidenceSha256,
  }
}

function luaTransitionTable(): string {
  const states = Object.entries(TRANSITIONS).map(([status, events]) => {
    const entries = Object.entries(events).map(([event, next]) => `[${JSON.stringify(event)}]=${JSON.stringify(next)}`).join(',')
    return `[${JSON.stringify(status)}]={${entries}}`
  })
  return `{${states.join(',')}}`
}

const TRANSITION_LUA = `
local status=redis.call('HGET',KEYS[1],'status') or 'pending'
local version=tonumber(redis.call('HGET',KEYS[1],'version') or '0')
if redis.call('EXISTS',KEYS[3])==1 then return {2,status,version} end
local transitions=${luaTransitionTable()}
local next=(transitions[status] or {})[ARGV[4]]
if not next then return {0,status,version} end
version=version+1
local created=redis.call('HGET',KEYS[1],'created_at') or ARGV[5]
local terminal=(next=='completed' or next=='failed' or next=='cancelled') and ARGV[5] or ''
redis.call('HSET',KEYS[1],'tenant_id',ARGV[1],'task_id',ARGV[2],'status',next,'version',version,'created_at',created,'updated_at',ARGV[5],'terminal_at',terminal,'last_transition_id',ARGV[3],'last_event',ARGV[4],'last_actor',ARGV[6],'last_evidence_sha256',ARGV[7])
redis.call('EXPIRE',KEYS[1],ARGV[8])
local event=cjson.encode({version=version,transitionId=ARGV[3],event=ARGV[4],from=status,to=next,occurredAt=ARGV[5],actor=cjson.decode(ARGV[6]),evidenceSha256=ARGV[7]})
redis.call('RPUSH',KEYS[2],event)
redis.call('LTRIM',KEYS[2],-tonumber(ARGV[9]),-1)
redis.call('EXPIRE',KEYS[2],ARGV[8])
redis.call('SET',KEYS[3],version,'EX',ARGV[8])
return {1,next,version}
`

const redis = Redis.fromEnv()

export class UpstashWorkflowTaskStore implements WorkflowTaskStore {
  async transition(input: WorkflowTransitionInput): Promise<WorkflowTransitionResult> {
    assertTransition(input)
    const occurredAt = input.occurredAt ?? new Date().toISOString()
    const keys = [taskKey(input.tenantId, input.taskId), eventsKey(input.tenantId, input.taskId), transitionKey(input.tenantId, input.taskId, input.transitionId)]
    const result = await traceRedisQuery('EVAL', () => redis.eval(TRANSITION_LUA, keys, [
      input.tenantId, input.taskId, input.transitionId, input.event, occurredAt, JSON.stringify(input.actor), input.evidenceSha256,
      String(WORKFLOW_TTL_SECONDS), String(MAX_RETAINED_EVENTS),
    ])) as Array<string | number>
    const code = Number(result[0])
    const state = await this.get(input.tenantId, input.taskId) ?? (code === 0 ? pendingState(input, occurredAt) : null)
    if (!state) throw new Error('Workflow transition did not produce durable state.')
    return { accepted: code > 0, idempotent: code === 2, ...(code === 0 ? { reason: 'invalid_transition' as const } : {}), state }
  }

  async get(tenantId: string, taskId: string): Promise<WorkflowTaskState | null> {
    assertIdentifier(tenantId, 'tenantId')
    assertIdentifier(taskId, 'taskId')
    const values = await traceRedisQuery('HGETALL', () => redis.hgetall<Record<string, unknown>>(taskKey(tenantId, taskId)))
    return values && Object.keys(values).length > 0 ? parseState(values) : null
  }

  async events(tenantId: string, taskId: string): Promise<WorkflowTaskEvent[]> {
    assertIdentifier(tenantId, 'tenantId')
    assertIdentifier(taskId, 'taskId')
    const values = await traceRedisQuery('LRANGE', () => redis.lrange<string | WorkflowTaskEvent>(eventsKey(tenantId, taskId), 0, -1))
    return (values ?? []).map((value) => typeof value === 'string' ? JSON.parse(value) as WorkflowTaskEvent : value)
  }
}

export class MemoryWorkflowTaskStore implements WorkflowTaskStore {
  private readonly states = new Map<string, WorkflowTaskState>()
  private readonly history = new Map<string, WorkflowTaskEvent[]>()
  private readonly transitions = new Set<string>()

  private key(tenantId: string, taskId: string): string { return `${tenantId}\n${taskId}` }

  async transition(input: WorkflowTransitionInput): Promise<WorkflowTransitionResult> {
    assertTransition(input)
    const key = this.key(input.tenantId, input.taskId)
    const replayKey = `${key}\n${input.transitionId}`
    const current = this.states.get(key)
    if (this.transitions.has(replayKey)) return { accepted: true, idempotent: true, state: { ...current!, lastActor: { ...current!.lastActor } } }
    const from = current?.status ?? 'pending'
    const to = nextWorkflowStatus(from, input.event)
    if (!to) {
      const fallback = current ?? pendingState(input, input.occurredAt ?? new Date().toISOString())
      return { accepted: false, idempotent: false, reason: 'invalid_transition', state: fallback }
    }
    const occurredAt = input.occurredAt ?? new Date().toISOString()
    const version = (current?.version ?? 0) + 1
    const state: WorkflowTaskState = {
      tenantId: input.tenantId, taskId: input.taskId, status: to, version,
      createdAt: current?.createdAt ?? occurredAt, updatedAt: occurredAt, terminalAt: TERMINAL.has(to) ? occurredAt : null,
      lastTransitionId: input.transitionId, lastEvent: input.event, lastActor: { ...input.actor }, lastEvidenceSha256: input.evidenceSha256,
    }
    const event: WorkflowTaskEvent = { version, transitionId: input.transitionId, event: input.event, from, to, occurredAt, actor: { ...input.actor }, evidenceSha256: input.evidenceSha256 }
    this.states.set(key, state)
    this.transitions.add(replayKey)
    const history = [...(this.history.get(key) ?? []), event].slice(-MAX_RETAINED_EVENTS)
    this.history.set(key, history)
    return { accepted: true, idempotent: false, state: { ...state, lastActor: { ...state.lastActor } } }
  }

  async get(tenantId: string, taskId: string): Promise<WorkflowTaskState | null> {
    const value = this.states.get(this.key(tenantId, taskId))
    return value ? { ...value, lastActor: { ...value.lastActor } } : null
  }

  async events(tenantId: string, taskId: string): Promise<WorkflowTaskEvent[]> {
    return (this.history.get(this.key(tenantId, taskId)) ?? []).map((event) => ({ ...event, actor: { ...event.actor } }))
  }
}
