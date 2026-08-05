/** Versioned contract for the asynchronous GPU QUBO/Ising heuristic. */

export const JOB_KINDS = ['qubo-ising'] as const
export type JobKind = (typeof JOB_KINDS)[number]

export const JOB_STATUSES = ['queued', 'processing', 'completed', 'failed', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['completed', 'failed', 'cancelled']

export const JOB_ID_PATTERN = /^job_[a-f0-9]{32}$/
export function createJobId(): string { return `job_${crypto.randomUUID().replaceAll('-', '')}` }
export function validJobId(value: string): boolean { return JOB_ID_PATTERN.test(value) }

export type ProblemFormulation = 'qubo' | 'ising'
export type QuboTerm = { i: number; j: number; value: number }

export type QuboIsingJobRequest = {
  clientRequestId: string
  problem: { formulation: ProblemFormulation; size: number; terms: QuboTerm[] }
  solver: {
    maxSweeps: number
    replicas: number
    seed: number
    exactThreshold: number
    initialTemperature: number | null
    finalTemperature: number | null
  }
  target: 'gpu'
  timeoutSeconds: number
}

// The production envelope is deliberately limited to the largest benchmarked
// case. Increasing it requires new hardware evidence and a contract revision.
export const MAX_PROBLEM_SIZE = 256
export const MAX_INLINE_TERMS = 32_896 // upper triangle for n=256
export const MAX_JOB_TIMEOUT_SECONDS = 600
export const DEFAULT_JOB_TIMEOUT_SECONDS = 120

export class JobValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'JobValidationError'; this.code = code }
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function finiteNumberOrNull(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new JobValidationError('invalid_solver', `solver.${field} must be a finite number.`)
  return value
}

function boundedInteger(value: unknown, field: string, fallback: number, minimum: number, maximum: number): number {
  const normalized = value === undefined || value === null ? fallback : value
  if (!Number.isInteger(normalized) || (normalized as number) < minimum || (normalized as number) > maximum) {
    throw new JobValidationError('invalid_solver', `solver.${field} must be an integer from ${minimum} to ${maximum}.`)
  }
  return normalized as number
}

function parseTerms(value: unknown, size: number): QuboTerm[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_INLINE_TERMS) {
    throw new JobValidationError('invalid_problem_terms', `problem.terms must contain 1–${MAX_INLINE_TERMS} sparse upper-triangular terms.`)
  }
  return value.map((entry, index) => {
    const term = objectOf(entry)
    if (!term) throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}] must be an object.`)
    const { i, j, value: coefficient } = term
    if (!Number.isInteger(i) || !Number.isInteger(j) || (i as number) < 0 || (j as number) < (i as number) || (j as number) >= size) {
      throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}] must satisfy 0 <= i <= j < ${size}.`)
    }
    if (typeof coefficient !== 'number' || !Number.isFinite(coefficient)) {
      throw new JobValidationError('invalid_problem_terms', `problem.terms[${index}].value must be finite.`)
    }
    return { i: i as number, j: j as number, value: coefficient }
  })
}

export function parseQuboIsingJobRequest(body: unknown): QuboIsingJobRequest {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Request body must be a JSON object.')
  const clientRequestId = typeof root.clientRequestId === 'string' ? root.clientRequestId.trim() : ''
  if (clientRequestId.length < 8 || clientRequestId.length > 120 || /[\r\n]/.test(clientRequestId)) {
    throw new JobValidationError('invalid_client_request_id', 'clientRequestId must contain 8–120 characters on one line.')
  }
  const problem = objectOf(root.problem)
  if (!problem || (problem.formulation !== 'qubo' && problem.formulation !== 'ising')) {
    throw new JobValidationError('invalid_problem', 'problem.formulation must be "qubo" or "ising".')
  }
  if (!Number.isInteger(problem.size) || (problem.size as number) < 1 || (problem.size as number) > MAX_PROBLEM_SIZE) {
    throw new JobValidationError('invalid_problem_size', `problem.size must be an integer from 1 to ${MAX_PROBLEM_SIZE}; larger sizes have not passed the hardware promotion gate.`)
  }
  if ('termsUrl' in problem) throw new JobValidationError('invalid_problem_terms', 'Remote term files are not supported; submit bounded inline terms.')
  const size = problem.size as number
  const solver = objectOf(root.solver) ?? {}
  const maxSweeps = boundedInteger(solver.maxSweeps, 'maxSweeps', 64, 1, 256)
  const replicas = boundedInteger(solver.replicas, 'replicas', 64, 1, 256)
  const seed = boundedInteger(solver.seed, 'seed', 0, -2_147_483_648, 2_147_483_647)
  const exactThreshold = boundedInteger(solver.exactThreshold, 'exactThreshold', 18, 0, 18)
  const initialTemperature = finiteNumberOrNull(solver.initialTemperature, 'initialTemperature')
  const finalTemperature = finiteNumberOrNull(solver.finalTemperature, 'finalTemperature')
  if (initialTemperature !== null && initialTemperature <= 0) throw new JobValidationError('invalid_solver', 'solver.initialTemperature must be positive.')
  if (finalTemperature !== null && finalTemperature <= 0) throw new JobValidationError('invalid_solver', 'solver.finalTemperature must be positive.')
  if (initialTemperature !== null && finalTemperature !== null && finalTemperature > initialTemperature) {
    throw new JobValidationError('invalid_solver', 'solver.finalTemperature must not exceed solver.initialTemperature.')
  }
  const rawTimeout = root.timeoutSeconds ?? DEFAULT_JOB_TIMEOUT_SECONDS
  if (!Number.isInteger(rawTimeout) || (rawTimeout as number) < 1 || (rawTimeout as number) > MAX_JOB_TIMEOUT_SECONDS) {
    throw new JobValidationError('invalid_timeout', `timeoutSeconds must be an integer from 1 to ${MAX_JOB_TIMEOUT_SECONDS}.`)
  }
  if (root.target !== undefined && root.target !== 'gpu') throw new JobValidationError('invalid_target', 'target must be "gpu".')
  return {
    clientRequestId,
    problem: { formulation: problem.formulation, size, terms: parseTerms(problem.terms, size) },
    solver: { maxSweeps, replicas, seed, exactThreshold, initialTemperature, finalTemperature },
    target: 'gpu',
    timeoutSeconds: rawTimeout as number,
  }
}

export const WORKER_CONTRACT_VERSION = '2.0.0'

export type WorkerHandoff = {
  contractVersion: typeof WORKER_CONTRACT_VERSION
  jobId: string
  kind: JobKind
  callbackUrl: string
  timeoutSeconds: number
  expiresAt: string
  zeroDataRetention: boolean
  problem: QuboIsingJobRequest['problem']
  solver: QuboIsingJobRequest['solver']
  target: 'gpu'
  inputHash: string
}

export type WorkerSolution = {
  objectiveValue: number
  assignment: number[]
  bestBound: number | null
  provenOptimal: boolean
}

export type WorkerDiagnostics = {
  algorithm: 'exhaustive-enumeration' | 'parallel-update-simulated-annealing-torch-v1'
  sweepsCompleted: number
  replicas: number | null
  acceptedMoves: number | null
  wallClockSeconds: number
  deviceClass: string
}

export type WorkerCallback = {
  contractVersion: typeof WORKER_CONTRACT_VERSION
  jobId: string
  inputHash: string
  status: 'completed' | 'failed'
  solution: WorkerSolution | null
  diagnostics: WorkerDiagnostics | null
  error: { code: string; message: string } | null
  usage: { deviceSeconds: number } | null
}

function parseUsage(value: unknown): { deviceSeconds: number } | null {
  const usage = objectOf(value)
  return usage && typeof usage.deviceSeconds === 'number' && Number.isFinite(usage.deviceSeconds) && usage.deviceSeconds >= 0
    ? { deviceSeconds: usage.deviceSeconds }
    : null
}

export function parseWorkerCallback(body: unknown): WorkerCallback {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Callback body must be a JSON object.')
  if (root.contractVersion !== WORKER_CONTRACT_VERSION) throw new JobValidationError('unsupported_contract_version', `Worker callback contractVersion must be "${WORKER_CONTRACT_VERSION}".`)
  if (typeof root.jobId !== 'string' || !validJobId(root.jobId)) throw new JobValidationError('invalid_job_id', 'Callback jobId is malformed.')
  if (typeof root.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(root.inputHash)) throw new JobValidationError('invalid_input_hash', 'Callback inputHash must be a SHA-256 hex digest.')
  if (root.status !== 'completed' && root.status !== 'failed') throw new JobValidationError('invalid_status', 'Callback status must be "completed" or "failed".')
  if (root.status === 'failed') {
    const error = objectOf(root.error)
    if (!error || typeof error.code !== 'string' || typeof error.message !== 'string') throw new JobValidationError('invalid_error', 'A failed callback must carry error.code and error.message.')
    return { contractVersion: WORKER_CONTRACT_VERSION, jobId: root.jobId, inputHash: root.inputHash, status: 'failed', solution: null, diagnostics: null, error: { code: error.code.slice(0, 64), message: error.message.slice(0, 500) }, usage: parseUsage(root.usage) }
  }
  const solution = objectOf(root.solution)
  if (!solution || typeof solution.objectiveValue !== 'number' || !Number.isFinite(solution.objectiveValue) || !Array.isArray(solution.assignment) || solution.assignment.some((value) => !Number.isInteger(value))) {
    throw new JobValidationError('invalid_solution', 'A completed callback must carry a finite objective and integer assignment.')
  }
  const bestBound = solution.bestBound === null || solution.bestBound === undefined ? null : solution.bestBound
  if (bestBound !== null && (typeof bestBound !== 'number' || !Number.isFinite(bestBound))) throw new JobValidationError('invalid_solution', 'solution.bestBound must be finite or null.')
  const diagnostics = objectOf(root.diagnostics)
  const algorithms = ['exhaustive-enumeration', 'parallel-update-simulated-annealing-torch-v1']
  if (!diagnostics || !algorithms.includes(String(diagnostics.algorithm)) || typeof diagnostics.wallClockSeconds !== 'number' || !Number.isFinite(diagnostics.wallClockSeconds) || !Number.isInteger(diagnostics.sweepsCompleted)) {
    throw new JobValidationError('invalid_diagnostics', 'Completed callbacks require bounded, recognized diagnostics.')
  }
  return {
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId: root.jobId,
    inputHash: root.inputHash,
    status: 'completed',
    solution: { objectiveValue: solution.objectiveValue, assignment: solution.assignment as number[], bestBound: bestBound as number | null, provenOptimal: solution.provenOptimal === true },
    diagnostics: {
      algorithm: diagnostics.algorithm as WorkerDiagnostics['algorithm'],
      sweepsCompleted: diagnostics.sweepsCompleted as number,
      replicas: Number.isInteger(diagnostics.replicas) ? diagnostics.replicas as number : null,
      acceptedMoves: Number.isInteger(diagnostics.acceptedMoves) ? diagnostics.acceptedMoves as number : null,
      wallClockSeconds: diagnostics.wallClockSeconds,
      deviceClass: typeof diagnostics.deviceClass === 'string' ? diagnostics.deviceClass.slice(0, 64) : 'unspecified',
    },
    error: null,
    usage: parseUsage(root.usage),
  }
}
