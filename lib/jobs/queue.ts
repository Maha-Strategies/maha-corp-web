/**
 * Redis-backed job queue and state machine for the optimization engine.
 *
 * WHY REDIS AND NOT QSTASH: this repository already depends on @upstash/redis
 * and nothing else Upstash-shaped. QStash would add a dependency, a second
 * signing secret, and a second delivery-state store that can disagree with the
 * job hash about whether a job is still live. Redis holds the authoritative
 * state either way, so QStash would only be buying us HTTP retry — which the
 * reclaim sweep below already provides, against state we can actually inspect.
 *
 * If QStash is adopted later, `dispatchToWorker` is the seam: publish there
 * instead of fetching, and leave the rest of this module untouched.
 *
 * STORAGE MODEL
 *   job:data:<jobId>          hash   authoritative job record
 *   job:queue:<kind>          list   jobIds awaiting dispatch (LPUSH / RPOP)
 *   job:pending               zset   jobId -> expiry epoch, swept for reclaim
 *   job:idem:<keyId>:<hash>   string clientRequestId -> jobId, 24h
 *
 * The zset is the safety net. A worker that dies without posting a callback
 * would otherwise leave a job `processing` forever and a credit reservation
 * permanently held; the sweep fails those jobs and refunds them.
 */

import { createHash } from 'node:crypto'

import { redis } from '@/lib/redis'
import { consumeAdditionalApiCredits, creditKeyById } from '@/lib/api-key'
import { quoteJobCredits } from '@/lib/jobs/pricing'
import { scopedRedisKey } from '@/lib/redis-namespace'
import { releaseHeldSlot } from '@/lib/x402/slot'
import {
  createJobId,
  type BinaryOptimizationSolution,
  type GeometricRegistrationJobRequest,
  type GeometricRegistrationSolution,
  type JobRequest,
  type JobKind,
  type JobStatus,
  type QuboIsingJobRequest,
  type TensorNetworkJobRequest,
  type WorkerCallback,
  type WorkerDiagnostics,
  type WorkerHandoff,
  type WorkerSolution,
  WORKER_CONTRACT_VERSION,
} from '@/lib/jobs/contract'

const JOB_TTL_SECONDS = 604_800 // 7 days for a completed record
const ZDR_JOB_TTL_SECONDS = 86_400 // 24 hours when the key is zero-data-retention
const IDEMPOTENCY_TTL_SECONDS = 86_400

export function jobDataKey(jobId: string) { return scopedRedisKey(`job:data:${jobId}`) }
export function jobQueueKey(kind: JobKind) { return scopedRedisKey(`job:queue:${kind}`) }
export const JOB_PENDING_ZSET = scopedRedisKey('job:pending')
function idempotencyKey(keyId: string, clientRequestId: string) {
  return scopedRedisKey(`job:idem:${keyId}:${createHash('sha256').update(clientRequestId).digest('hex').slice(0, 32)}`)
}

// ---------------------------------------------------------------------------
// Job record
// ---------------------------------------------------------------------------

export type JobRecord = {
  jobId: string
  kind: JobKind
  status: JobStatus
  keyId: string
  clientRequestId: string
  inputHash: string
  problemSize: number
  formulation: string
  target: string
  zeroDataRetention: boolean
  reservedCredits: number
  creditsCharged: number | null
  createdAt: string
  updatedAt: string
  expiresAt: string
  attempts: number
  solution: WorkerSolution | null
  diagnostics: WorkerDiagnostics | null
  error: { code: string; message: string } | null
  deviceSeconds: number | null
  /** Held x402 capacity slot, released when the job reaches a terminal state.
   *  Null for credit-authenticated jobs, which hold no slot. */
  slot: { resource: string; token: string } | null
}

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try { return JSON.parse(value) as T } catch { return null }
}

/**
 * Upstash's client auto-deserializes JSON-looking hash values, so a field may
 * arrive as a string or as an already-parsed object depending on what was
 * written. Both are handled rather than assuming one.
 */
function readJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return parseJson<T>(value)
  return value as T
}

function toJobRecord(raw: Record<string, unknown> | null): JobRecord | null {
  if (!raw || typeof raw.jobId !== 'string') return null
  const reservedCredits = Number(raw.reservedCredits)
  const creditsChargedRaw = raw.creditsCharged
  return {
    jobId: raw.jobId,
    kind: String(raw.kind) as JobKind,
    status: String(raw.status) as JobStatus,
    keyId: String(raw.keyId),
    clientRequestId: String(raw.clientRequestId),
    inputHash: String(raw.inputHash),
    problemSize: Number(raw.problemSize),
    formulation: String(raw.formulation),
    target: String(raw.target),
    zeroDataRetention: String(raw.zeroDataRetention) === 'true',
    reservedCredits: Number.isFinite(reservedCredits) ? reservedCredits : 0,
    creditsCharged: creditsChargedRaw === undefined || creditsChargedRaw === null || creditsChargedRaw === '' ? null : Number(creditsChargedRaw),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    expiresAt: String(raw.expiresAt),
    attempts: Number(raw.attempts) || 0,
    solution: readJsonField<WorkerSolution>(raw.solution),
    diagnostics: readJsonField<WorkerDiagnostics>(raw.diagnostics),
    error: readJsonField<{ code: string; message: string }>(raw.error),
    deviceSeconds: raw.deviceSeconds === undefined || raw.deviceSeconds === null || raw.deviceSeconds === '' ? null : Number(raw.deviceSeconds),
    slot: raw.slotResource && raw.slotToken ? { resource: String(raw.slotResource), token: String(raw.slotToken) } : null,
  }
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const raw = await redis.hgetall<Record<string, unknown>>(jobDataKey(jobId))
  return toJobRecord(raw)
}

/**
 * Canonical problem encoding for the input hash.
 *
 * Key order is fixed explicitly rather than relying on JSON.stringify's
 * insertion order, so a refactor that reorders the object literal above cannot
 * silently change every hash and break worker-side echo comparison.
 */
export function computeInputHash(kind: JobKind, request: JobRequest): string {
  const canonical = JSON.stringify([kind, request.problem, request.solver, request.target])
  return createHash('sha256').update(canonical).digest('hex')
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export type EnqueueOutcome =
  | { kind: 'queued'; job: JobRecord; handoff: WorkerHandoff }
  | { kind: 'duplicate'; job: JobRecord }
  | { kind: 'insufficient_credits'; required: number }
  | { kind: 'unavailable' }

export async function enqueueJob(input: {
  kind: JobKind
  request: JobRequest
  keyId: string
  zeroDataRetention: boolean
  callbackUrl: string
  /**
   * The x402 capacity slot this job holds, when the caller paid rather than
   * spending credits. Stored on the record so the completion webhook can
   * release it; the route cannot, because it returns at dispatch while the GPU
   * is still running. Absent for every credit-authenticated job.
   */
  slot?: { resource: string; token: string } | null
}): Promise<EnqueueOutcome> {
  const kind = input.kind
  const idemKey = idempotencyKey(input.keyId, input.request.clientRequestId)

  // Idempotency first. A client retrying a POST after a network timeout must
  // not be charged twice or start a second GPU run — SET NX is what makes the
  // retry converge on the original job instead of creating a sibling.
  const jobId = createJobId()
  const claimed = await redis.set(idemKey, jobId, { nx: true, ex: IDEMPOTENCY_TTL_SECONDS })
  if (claimed === null) {
    const existingId = await redis.get<string>(idemKey)
    const existing = existingId ? await getJob(existingId) : null
    if (existing) return { kind: 'duplicate', job: existing }
    // The idempotency key outlived its job record. Fall through and let this
    // request build a fresh job under the same key rather than failing.
    await redis.set(idemKey, jobId, { ex: IDEMPOTENCY_TTL_SECONDS })
  }

  const problemSize = 'size' in input.request.problem ? input.request.problem.size : input.request.problem.sourcePoints.length
  const formulation = 'formulation' in input.request.problem ? input.request.problem.formulation : 'se3-paired-registration'
  const credits = quoteJobCredits(kind, problemSize)

  // Reserve before any work is scheduled. Charging on completion was the
  // alternative and it is unsound: the balance can be spent elsewhere while the
  // GPU runs, so the platform would eat the compute for every job whose owner
  // drained their balance mid-run. The reservation is refunded on failure,
  // cancellation, and expiry, so the customer is never charged for work that
  // did not produce a result.
  const reservation = await consumeAdditionalApiCredits(input.keyId, credits)
  if (reservation.kind === 'depleted') {
    await redis.del(idemKey)
    return { kind: 'insufficient_credits', required: credits }
  }
  if (reservation.kind === 'unavailable') {
    await redis.del(idemKey)
    return { kind: 'unavailable' }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + input.request.timeoutSeconds * 1000)
  const inputHash = computeInputHash(kind, input.request)

  const record: Record<string, string> = {
    jobId,
    kind,
    status: 'queued',
    keyId: input.keyId,
    clientRequestId: input.request.clientRequestId,
    inputHash,
    problemSize: String(problemSize),
    formulation,
    target: input.request.target,
    zeroDataRetention: String(input.zeroDataRetention),
    reservedCredits: String(credits),
    creditsCharged: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    attempts: '0',
    solution: '',
    diagnostics: '',
    error: '',
    deviceSeconds: '',
    slotResource: input.slot?.resource ?? '',
    slotToken: input.slot?.token ?? '',
  }

  try {
    await redis.hset(jobDataKey(jobId), record)
    await redis.expire(jobDataKey(jobId), input.zeroDataRetention ? ZDR_JOB_TTL_SECONDS : JOB_TTL_SECONDS)
    await redis.zadd(JOB_PENDING_ZSET, { score: expiresAt.getTime(), member: jobId })
    await redis.lpush(jobQueueKey(kind), jobId)
  } catch (error) {
    // Compensate the reservation rather than leaving the caller charged for a
    // job that was never persisted. A refund that itself fails is logged and
    // caught by the reconciliation sweep; it must not mask the original error.
    await creditKeyById(input.keyId, credits).catch(() => undefined)
    await redis.del(idemKey).catch(() => undefined)
    throw error
  }

  const job = toJobRecord(record as unknown as Record<string, unknown>)!

  const handoff: WorkerHandoff = {
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId,
    kind,
    callbackUrl: input.callbackUrl,
    timeoutSeconds: input.request.timeoutSeconds,
    expiresAt: expiresAt.toISOString(),
    zeroDataRetention: input.zeroDataRetention,
    problem: input.request.problem,
    solver: input.request.solver,
    target: input.request.target,
    inputHash,
  }

  return { kind: 'queued', job, handoff }
}

export function enqueueQuboIsingJob(input: Omit<Parameters<typeof enqueueJob>[0], 'kind' | 'request'> & { request: QuboIsingJobRequest }) {
  return enqueueJob({ ...input, kind: 'qubo-ising', request: input.request })
}

export function enqueueTensorNetworkJob(input: Omit<Parameters<typeof enqueueJob>[0], 'kind' | 'request'> & { request: TensorNetworkJobRequest }) {
  return enqueueJob({ ...input, kind: 'tensor-network', request: input.request })
}

export function enqueueGeometricRegistrationJob(input: Omit<Parameters<typeof enqueueJob>[0], 'kind' | 'request'> & { request: GeometricRegistrationJobRequest }) {
  return enqueueJob({ ...input, kind: 'geometric-registration', request: input.request })
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

/**
 * Terminal-state guard.
 *
 * Returns 1 only for the caller that actually performed the transition. Every
 * later duplicate returns 0, which is what makes a replayed worker callback
 * settle credits exactly once. Doing this as a read-then-write in application
 * code would race under concurrent retries — two callbacks arriving together
 * would both read `processing` and both charge.
 */
const TRANSITION_SCRIPT = `
local key = KEYS[1]
local target = ARGV[1]
local updatedAt = ARGV[2]
if redis.call('EXISTS', key) == 0 then return -1 end
local current = redis.call('HGET', key, 'status')
if current == 'completed' or current == 'failed' or current == 'cancelled' then return 0 end
if current == target then return 0 end
redis.call('HSET', key, 'status', target, 'updatedAt', updatedAt)
return 1
`

export async function markJobProcessing(jobId: string): Promise<boolean> {
  const result = await redis.eval(TRANSITION_SCRIPT, [jobDataKey(jobId)], ['processing', new Date().toISOString()])
  if (result === 1) await redis.hincrby(jobDataKey(jobId), 'attempts', 1)
  return result === 1
}

/**
 * Apply a worker callback: transition to terminal state and write results,
 * atomically, returning whether THIS call was the transition.
 *
 * The result fields are written inside the same script as the status change so
 * a reader can never observe `completed` with an empty solution.
 */
const SETTLE_SCRIPT = `
local key = KEYS[1]
local target = ARGV[1]
local updatedAt = ARGV[2]
local solution = ARGV[3]
local diagnostics = ARGV[4]
local errorPayload = ARGV[5]
local deviceSeconds = ARGV[6]
local creditsCharged = ARGV[7]
if redis.call('EXISTS', key) == 0 then return -1 end
local current = redis.call('HGET', key, 'status')
if current == 'completed' or current == 'failed' or current == 'cancelled' then return 0 end
redis.call('HSET', key, 'status', target, 'updatedAt', updatedAt, 'solution', solution,
  'diagnostics', diagnostics, 'error', errorPayload, 'deviceSeconds', deviceSeconds,
  'creditsCharged', creditsCharged)
return 1
`

export type SettleOutcome =
  | { kind: 'settled'; job: JobRecord; creditsCharged: number; creditsRefunded: number }
  | { kind: 'already_terminal'; job: JobRecord }
  | { kind: 'unknown_job' }
  | { kind: 'input_hash_mismatch'; job: JobRecord }
  | { kind: 'invalid_result'; job: JobRecord }

export async function settleJobFromCallback(callback: WorkerCallback): Promise<SettleOutcome> {
  const job = await getJob(callback.jobId)
  if (!job) return { kind: 'unknown_job' }

  if (callback.kind !== job.kind) return { kind: 'input_hash_mismatch', job }

  // The worker echoes the input hash we sent. A mismatch means the result does
  // not belong to this job's problem — reject it rather than storing a solution
  // to a question nobody asked.
  if (callback.inputHash !== job.inputHash) return { kind: 'input_hash_mismatch', job }

  if (callback.status === 'completed' && callback.solution && job.kind !== 'geometric-registration') {
    const solution = callback.solution as BinaryOptimizationSolution
    const domain = job.formulation === 'qubo' ? new Set([0, 1]) : new Set([-1, 1])
    if (solution.assignment.length !== job.problemSize || solution.assignment.some((value) => !domain.has(value))) {
      return { kind: 'invalid_result', job }
    }
    if (solution.provenOptimal && (job.problemSize > 18 || callback.diagnostics?.algorithm !== 'exhaustive-enumeration')) {
      return { kind: 'invalid_result', job }
    }
  }
  if (callback.status === 'completed' && callback.solution && job.kind === 'geometric-registration') {
    const solution = callback.solution as GeometricRegistrationSolution
    const determinantBoundary = Math.abs(solution.determinant - 1) <= 1e-5
    const orthogonalityBoundary = (callback.diagnostics?.orthogonalityResidual ?? Number.POSITIVE_INFINITY) <= 1e-5
    if (!determinantBoundary || !orthogonalityBoundary || callback.diagnostics?.pointCount !== job.problemSize) return { kind: 'invalid_result', job }
  }

  const completed = callback.status === 'completed'
  const creditsCharged = completed ? job.reservedCredits : 0
  const creditsRefunded = completed ? 0 : job.reservedCredits

  const transitioned = await redis.eval(
    SETTLE_SCRIPT,
    [jobDataKey(callback.jobId)],
    [
      completed ? 'completed' : 'failed',
      new Date().toISOString(),
      callback.solution ? JSON.stringify(callback.solution) : '',
      callback.diagnostics ? JSON.stringify(callback.diagnostics) : '',
      callback.error ? JSON.stringify(callback.error) : '',
      callback.usage ? String(callback.usage.deviceSeconds) : '',
      String(creditsCharged),
    ],
  )

  if (transitioned !== 1) {
    const current = await getJob(callback.jobId)
    return current ? { kind: 'already_terminal', job: current } : { kind: 'unknown_job' }
  }

  await redis.zrem(JOB_PENDING_ZSET, callback.jobId)

  // The GPU is free now, so the capacity slot is too. Only the winning
  // transition reaches here, and ZREM of an already-removed token is a no-op,
  // so a replayed callback cannot free a slot twice.
  await releaseHeldSlot(job.slot)

  // Only the winning transition refunds, so a replayed failure callback cannot
  // credit the balance twice.
  if (creditsRefunded > 0) await creditKeyById(job.keyId, creditsRefunded).catch(() => undefined)

  const settled = await getJob(callback.jobId)
  return { kind: 'settled', job: settled ?? job, creditsCharged, creditsRefunded }
}

// ---------------------------------------------------------------------------
// Dispatch and reclaim
// ---------------------------------------------------------------------------

/**
 * Fail closed before reserving credits when the worker handoff or callback
 * cannot be authenticated. This is deliberately a presence/configuration
 * check only: a stale token or unreachable worker is handled by the
 * post-enqueue dispatch compensation below.
 */
export function workerDispatchConfigured(): boolean {
  const workerUrl = process.env.MAHA_WORKER_URL
  const workerToken = process.env.MAHA_WORKER_TOKEN
  const webhookSecret = process.env.MAHA_WORKER_WEBHOOK_SECRET
  if (!workerUrl || !workerToken || !webhookSecret) return false
  try { return new URL(workerUrl).protocol === 'https:' } catch { return false }
}

/**
 * Hand a job to the GPU worker.
 *
 * Called from `after()` in the route so the client's 202 is not blocked on the
 * worker's control plane. A false result must be followed by
 * `failUndispatchedJob`: the reclaim sweep only expires jobs after their
 * deadline and does not provide a retry queue.
 */
export async function dispatchToWorker(handoff: WorkerHandoff): Promise<boolean> {
  const workerUrl = process.env.MAHA_WORKER_URL
  const workerToken = process.env.MAHA_WORKER_TOKEN
  if (!workerUrl || !workerToken) {
    console.error('GPU worker dispatch skipped: worker URL or token is not configured.')
    return false
  }

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${workerToken}`,
        'Content-Type': 'application/json',
        'X-Maha-Job-Id': handoff.jobId,
        'X-Maha-Contract-Version': WORKER_CONTRACT_VERSION,
      },
      body: JSON.stringify(handoff),
      cache: 'no-store',
    })
    if (!response.ok) {
      console.error('GPU worker dispatch rejected.', { jobId: handoff.jobId, kind: handoff.kind, status: response.status })
      return false
    }
    await markJobProcessing(handoff.jobId)
    return true
  } catch (error) {
    console.error('GPU worker dispatch failed.', {
      jobId: handoff.jobId,
      kind: handoff.kind,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return false
  }
}

/**
 * Compensate a handoff that never reached the worker. The ordinary settlement
 * guard makes this idempotent and refunds the reservation exactly once.
 */
export function failUndispatchedJob(handoff: WorkerHandoff): Promise<SettleOutcome> {
  return settleJobFromCallback({
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId: handoff.jobId,
    kind: handoff.kind,
    inputHash: handoff.inputHash,
    status: 'failed',
    solution: null,
    diagnostics: null,
    error: { code: 'worker_dispatch_failed', message: 'The GPU worker did not accept the job. Reserved credits were refunded.' },
    usage: null,
  })
}

/**
 * Fail and refund jobs whose deadline passed without a callback.
 *
 * Wire to a scheduled route under app/api/cron/. Without this a worker that
 * crashes mid-run holds the customer's credits indefinitely, and the job sits
 * `processing` forever with no path out.
 */
export async function reclaimExpiredJobs(limit = 100): Promise<{ reclaimed: string[] }> {
  const expired = await redis.zrange<string[]>(JOB_PENDING_ZSET, 0, Date.now(), { byScore: true, offset: 0, count: limit })
  const reclaimed: string[] = []

  for (const jobId of expired) {
    const job = await getJob(jobId)
    if (!job) { await redis.zrem(JOB_PENDING_ZSET, jobId); continue }

    const transitioned = await redis.eval(
      SETTLE_SCRIPT,
      [jobDataKey(jobId)],
      ['failed', new Date().toISOString(), '', '', JSON.stringify({ code: 'job_expired', message: 'The job exceeded its deadline without a worker result.' }), '', '0'],
    )
    await redis.zrem(JOB_PENDING_ZSET, jobId)
    if (transitioned === 1) {
      // A worker that crashed mid-run would otherwise hold its slot until the
      // score expired. This is the second terminal path and must free it too.
      await releaseHeldSlot(job.slot)
      await creditKeyById(job.keyId, job.reservedCredits).catch(() => undefined)
      reclaimed.push(jobId)
    }
  }

  return { reclaimed }
}
