/**
 * Job contract for the asynchronous optimization engine.
 *
 * This module is the single definition of what a job IS — the request shape a
 * client posts, the handoff shape our backend sends a GPU worker, and the
 * callback shape the worker must post back. Route handlers, the queue, and the
 * published JSON Schema all derive from here so the three cannot drift.
 *
 * WHY THE CONTRACT LIVES IN ONE FILE: the worker runs in someone else's
 * infrastructure (Modal, RunPod, AWS). We cannot deploy a fix to it atomically
 * with a fix here. A field that means one thing on Vercel and another in the
 * worker is the failure mode this file exists to prevent.
 */

export const JOB_KINDS = ['tensor-opt', 'geometric-ai', 'holographic-qec', 'landscape-opt'] as const
export type JobKind = (typeof JOB_KINDS)[number]

/**
 * Job lifecycle.
 *
 * `queued` -> `processing` -> `completed` | `failed`, with `cancelled` reachable
 * from `queued` or `processing`. `completed` and `failed` are TERMINAL: the
 * transition guard in lib/jobs/queue.ts refuses to move a job out of them, which
 * is what makes a duplicate worker callback a no-op rather than a double charge.
 */
export const JOB_STATUSES = ['queued', 'processing', 'completed', 'failed', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['completed', 'failed', 'cancelled']

export const JOB_ID_PATTERN = /^job_[a-f0-9]{32}$/
export function createJobId(): string { return `job_${crypto.randomUUID().replaceAll('-', '')}` }
export function validJobId(value: string): boolean { return JOB_ID_PATTERN.test(value) }

// ---------------------------------------------------------------------------
// Client request — POST /api/v1/jobs/tensor-opt
// ---------------------------------------------------------------------------

export type ProblemFormulation = 'qubo' | 'ising'
export type ComputeTarget = 'gpu' | 'tpu'

/**
 * A sparse upper-triangular term list. Dense matrices are refused on purpose:
 * a 1e6-variable dense QUBO is a 1e12-entry body, which no request body should
 * ever carry. Callers with dense problems upload to object storage and pass
 * `problem.termsUrl` instead.
 */
export type QuboTerm = { i: number; j: number; value: number }

export type TensorOptJobRequest = {
  clientRequestId: string
  problem: {
    formulation: ProblemFormulation
    /** QUBO variable count or Ising spin count. */
    size: number
    /** Inline sparse terms, or null when `termsUrl` is used. */
    terms: QuboTerm[] | null
    /** Pre-signed URL to a sparse term file, or null when `terms` is inline. */
    termsUrl: string | null
  }
  solver: {
    bondDimensionMax: number | null
    maxSweeps: number | null
    truncationThreshold: number | null
    seed: number | null
  }
  target: ComputeTarget
  /** Client-supplied ceiling; the engine clamps it to MAX_JOB_TIMEOUT_SECONDS. */
  timeoutSeconds: number
}

export const MAX_INLINE_TERMS = 250_000
export const MAX_PROBLEM_SIZE = 1_000_000
export const MAX_JOB_TIMEOUT_SECONDS = 21_600 // 6 hours
export const DEFAULT_JOB_TIMEOUT_SECONDS = 3_600

export class JobValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'JobValidationError'; this.code = code }
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function optionalFiniteNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new JobValidationError('invalid_solver', `solver.${field} must be a finite number.`)
  return value
}

/**
 * Term validation rejects non-finite values explicitly.
 *
 * A NaN or Infinity coefficient survives JSON.parse, serializes back out
 * through JSON.stringify as `null`, and reaches the worker as a silently
 * different problem. Catching it here is the only place the original intent is
 * still visible.
 */
function parseTerms(value: unknown, size: number): QuboTerm[] {
  if (!Array.isArray(value)) throw new JobValidationError('invalid_problem_terms', 'problem.terms must be an array of {i, j, value} objects.')
  if (value.length > MAX_INLINE_TERMS) throw new JobValidationError('problem_too_large', `problem.terms holds at most ${MAX_INLINE_TERMS} inline entries; use problem.termsUrl for larger instances.`)
  return value.map((entry, index) => {
    const term = objectOf(entry)
    if (!term) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}] must be an object.`)
    const { i, j, value: coefficient } = term
    if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= size) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}].i must be an integer in [0, ${size}).`)
    if (!Number.isInteger(j) || (j as number) < 0 || (j as number) >= size) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}].j must be an integer in [0, ${size}).`)
    if ((i as number) > (j as number)) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}] must be upper-triangular (i <= j).`)
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient)) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}].value must be a finite number.`)
    return { i: i as number, j: j as number, value: coefficient }
  })
}

/** Only HTTPS term URLs are accepted — a term file is problem data in transit. */
function parseTermsUrl(value: unknown): string {
  if (typeof value !== 'string') throw new JobValidationError('invalid_problem_terms', 'problem.termsUrl must be a string.')
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new JobValidationError('invalid_problem_terms', 'problem.termsUrl must be an absolute URL.') }
  if (parsed.protocol !== 'https:') throw new JobValidationError('invalid_problem_terms', 'problem.termsUrl must use HTTPS.')
  return parsed.toString()
}

/**
 * Accepts both the v1 object form (`target: { kind: "tpu" }`) and the flat
 * string form (`target: "tpu"`), defaulting to GPU.
 *
 * An unrecognized value defaults rather than throwing, matching v1 behaviour so
 * an existing integration is not broken by this migration. Anything stricter
 * belongs in a v2 that clients opt into.
 */
function parseTarget(value: unknown): ComputeTarget {
  const kind = typeof value === 'string' ? value : objectOf(value)?.kind
  return kind === 'tpu' ? 'tpu' : 'gpu'
}

export function parseTensorOptJobRequest(body: unknown): TensorOptJobRequest {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Request body must be a JSON object.')

  const clientRequestId = typeof root.clientRequestId === 'string' ? root.clientRequestId.trim() : ''
  if (clientRequestId.length < 8 || clientRequestId.length > 120 || /[\r\n]/.test(clientRequestId)) {
    throw new JobValidationError('invalid_client_request_id', 'clientRequestId must contain 8–120 characters on one line.')
  }

  const problem = objectOf(root.problem)
  if (!problem) throw new JobValidationError('invalid_problem', 'problem must be an object.')

  const formulation = problem.formulation
  if (formulation !== 'qubo' && formulation !== 'ising') {
    throw new JobValidationError('invalid_problem', 'problem.formulation must be "qubo" or "ising".')
  }

  // The v1 mock accepted `variableCount` for QUBO and `spinCount` for Ising.
  // Both are still read so existing integrations keep working, but they
  // normalize to one field: two names for one quantity is how a size check ends
  // up validating a field the solver never reads.
  const rawSize = problem.size ?? (formulation === 'qubo' ? problem.variableCount : problem.spinCount)
  if (!Number.isInteger(rawSize) || (rawSize as number) < 1 || (rawSize as number) > MAX_PROBLEM_SIZE) {
    throw new JobValidationError('invalid_problem_size', `The QUBO variable count or Ising spin count must be an integer from 1 to ${MAX_PROBLEM_SIZE.toLocaleString('en-US')}.`)
  }
  const size = rawSize as number

  const hasInlineTerms = problem.terms !== undefined && problem.terms !== null
  const hasTermsUrl = problem.termsUrl !== undefined && problem.termsUrl !== null
  if (hasInlineTerms === hasTermsUrl) {
    throw new JobValidationError('invalid_problem_terms', 'Provide exactly one of problem.terms or problem.termsUrl.')
  }

  const solver = objectOf(root.solver) ?? {}
  const bondDimensionMax = optionalFiniteNumber(solver.bondDimensionMax, 'bondDimensionMax')
  if (bondDimensionMax !== null && (!Number.isInteger(bondDimensionMax) || bondDimensionMax < 1 || bondDimensionMax > 32_768)) {
    throw new JobValidationError('invalid_solver', 'solver.bondDimensionMax must be an integer from 1 to 32768.')
  }
  const maxSweeps = optionalFiniteNumber(solver.maxSweeps, 'maxSweeps')
  if (maxSweeps !== null && (!Number.isInteger(maxSweeps) || maxSweeps < 1 || maxSweeps > 100_000)) {
    throw new JobValidationError('invalid_solver', 'solver.maxSweeps must be an integer from 1 to 100000.')
  }
  const truncationThreshold = optionalFiniteNumber(solver.truncationThreshold, 'truncationThreshold')
  if (truncationThreshold !== null && (truncationThreshold < 0 || truncationThreshold >= 1)) {
    throw new JobValidationError('invalid_solver', 'solver.truncationThreshold must be in [0, 1).')
  }
  const seed = optionalFiniteNumber(solver.seed, 'seed')
  if (seed !== null && !Number.isInteger(seed)) throw new JobValidationError('invalid_solver', 'solver.seed must be an integer.')

  const rawTimeout = root.timeoutSeconds
  const timeoutSeconds = rawTimeout === undefined || rawTimeout === null
    ? DEFAULT_JOB_TIMEOUT_SECONDS
    : Number.isInteger(rawTimeout) && (rawTimeout as number) > 0
      ? Math.min(rawTimeout as number, MAX_JOB_TIMEOUT_SECONDS)
      : (() => { throw new JobValidationError('invalid_timeout', `timeoutSeconds must be a positive integer up to ${MAX_JOB_TIMEOUT_SECONDS}.`) })()

  return {
    clientRequestId,
    problem: {
      formulation,
      size,
      terms: hasInlineTerms ? parseTerms(problem.terms, size) : null,
      termsUrl: hasTermsUrl ? parseTermsUrl(problem.termsUrl) : null,
    },
    solver: { bondDimensionMax, maxSweeps, truncationThreshold, seed },
    target: parseTarget(root.target),
    timeoutSeconds,
  }
}

// ---------------------------------------------------------------------------
// Worker handoff — what WE send to the GPU worker
// ---------------------------------------------------------------------------

export const WORKER_CONTRACT_VERSION = '1.0.0'

export type WorkerHandoff = {
  contractVersion: string
  jobId: string
  kind: JobKind
  /**
   * Where the worker posts its result. Sent explicitly rather than configured
   * worker-side so preview and production deployments cannot cross-post.
   */
  callbackUrl: string
  /**
   * Seconds after which the worker must abandon the job and post a `failed`
   * callback with code `worker_timeout`. The engine also expires the job
   * independently — see `expiresAt` — so a worker that dies silently does not
   * strand a credit reservation.
   */
  timeoutSeconds: number
  expiresAt: string
  /**
   * Zero-data-retention flag, propagated from the API key record. When true the
   * worker must hold problem data in memory only, write no logs containing
   * coefficients, and persist nothing after the callback returns 2xx.
   */
  zeroDataRetention: boolean
  problem: TensorOptJobRequest['problem']
  solver: TensorOptJobRequest['solver']
  target: ComputeTarget
  /**
   * SHA-256 of the canonical problem encoding. The worker echoes it back; the
   * webhook compares. A mismatch means the worker solved something other than
   * what was enqueued, which is a silent-corruption class of bug that no
   * result-shape validation would catch.
   */
  inputHash: string
}

// ---------------------------------------------------------------------------
// Worker callback — what the WORKER sends back
// ---------------------------------------------------------------------------

export type WorkerSolution = {
  /** Objective value of the returned assignment, in the submitted formulation. */
  objectiveValue: number
  /** Variable assignment. QUBO returns 0/1, Ising returns -1/+1. */
  assignment: number[]
  /** Best bound the solver could certify, or null when it certifies none. */
  bestBound: number | null
  /** Whether the solver proved optimality. Defaults to false, never inferred. */
  provenOptimal: boolean
}

export type WorkerDiagnostics = {
  /** Largest bond dimension actually reached, which may be below the request's ceiling. */
  bondDimensionUsed: number | null
  sweepsCompleted: number | null
  /**
   * Summed discarded weight across truncations. This is the honest error
   * measure for an MPS/DMRG run and is required, not optional: a result whose
   * truncation error is unknown cannot be interpreted, and a solver that does
   * not track it should report null rather than zero.
   */
  discardedWeight: number | null
  wallClockSeconds: number
  deviceClass: string
}

export type WorkerCallback = {
  contractVersion: string
  jobId: string
  inputHash: string
  status: 'completed' | 'failed'
  solution: WorkerSolution | null
  diagnostics: WorkerDiagnostics | null
  error: { code: string; message: string } | null
  /** Metered compute the worker actually consumed, used to settle the reservation. */
  usage: { deviceSeconds: number } | null
}

export function parseWorkerCallback(body: unknown): WorkerCallback {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Callback body must be a JSON object.')

  if (root.contractVersion !== WORKER_CONTRACT_VERSION) {
    throw new JobValidationError('unsupported_contract_version', `Worker callback contractVersion must be "${WORKER_CONTRACT_VERSION}".`)
  }
  if (typeof root.jobId !== 'string' || !validJobId(root.jobId)) throw new JobValidationError('invalid_job_id', 'Callback jobId is malformed.')
  if (typeof root.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(root.inputHash)) throw new JobValidationError('invalid_input_hash', 'Callback inputHash must be a SHA-256 hex digest.')
  if (root.status !== 'completed' && root.status !== 'failed') throw new JobValidationError('invalid_status', 'Callback status must be "completed" or "failed".')

  if (root.status === 'failed') {
    const error = objectOf(root.error)
    if (!error || typeof error.code !== 'string' || typeof error.message !== 'string') {
      throw new JobValidationError('invalid_error', 'A failed callback must carry error.code and error.message.')
    }
    return {
      contractVersion: WORKER_CONTRACT_VERSION,
      jobId: root.jobId,
      inputHash: root.inputHash,
      status: 'failed',
      solution: null,
      diagnostics: null,
      error: { code: error.code.slice(0, 64), message: error.message.slice(0, 500) },
      usage: parseUsage(root.usage),
    }
  }

  const solution = objectOf(root.solution)
  if (!solution) throw new JobValidationError('invalid_solution', 'A completed callback must carry a solution object.')
  if (typeof solution.objectiveValue !== 'number' || !Number.isFinite(solution.objectiveValue)) {
    throw new JobValidationError('invalid_solution', 'solution.objectiveValue must be a finite number.')
  }
  if (!Array.isArray(solution.assignment) || solution.assignment.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new JobValidationError('invalid_solution', 'solution.assignment must be an array of finite numbers.')
  }
  const bestBound = solution.bestBound === undefined || solution.bestBound === null ? null : solution.bestBound
  if (bestBound !== null && (typeof bestBound !== 'number' || !Number.isFinite(bestBound))) {
    throw new JobValidationError('invalid_solution', 'solution.bestBound must be a finite number or null.')
  }

  const diagnostics = objectOf(root.diagnostics)
  if (!diagnostics || typeof diagnostics.wallClockSeconds !== 'number' || !Number.isFinite(diagnostics.wallClockSeconds)) {
    throw new JobValidationError('invalid_diagnostics', 'A completed callback must carry diagnostics.wallClockSeconds.')
  }

  return {
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId: root.jobId,
    inputHash: root.inputHash,
    status: 'completed',
    solution: {
      objectiveValue: solution.objectiveValue,
      assignment: solution.assignment as number[],
      bestBound: bestBound as number | null,
      // Absent means not proven. Optimality is never inferred from a missing field.
      provenOptimal: solution.provenOptimal === true,
    },
    diagnostics: {
      bondDimensionUsed: typeof diagnostics.bondDimensionUsed === 'number' ? diagnostics.bondDimensionUsed : null,
      sweepsCompleted: typeof diagnostics.sweepsCompleted === 'number' ? diagnostics.sweepsCompleted : null,
      discardedWeight: typeof diagnostics.discardedWeight === 'number' ? diagnostics.discardedWeight : null,
      wallClockSeconds: diagnostics.wallClockSeconds,
      deviceClass: typeof diagnostics.deviceClass === 'string' ? diagnostics.deviceClass.slice(0, 64) : 'unspecified',
    },
    error: null,
    usage: parseUsage(root.usage),
  }
}

function parseUsage(value: unknown): { deviceSeconds: number } | null {
  const usage = objectOf(value)
  if (!usage) return null
  const deviceSeconds = usage.deviceSeconds
  if (typeof deviceSeconds !== 'number' || !Number.isFinite(deviceSeconds) || deviceSeconds < 0) return null
  return { deviceSeconds }
}
