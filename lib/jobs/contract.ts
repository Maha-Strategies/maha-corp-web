/** Versioned contract for the asynchronous GPU QUBO/Ising heuristic. */

export const JOB_KINDS = ['qubo-ising', 'tensor-network', 'geometric-registration'] as const
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

export type TensorNetworkJobRequest = {
  clientRequestId: string
  problem: { formulation: ProblemFormulation; size: number; terms: QuboTerm[] }
  solver: { bondDimension: number; exactThreshold: number }
  target: 'gpu'
  timeoutSeconds: number
}

export type Point3 = [number, number, number]
export type GeometricRegistrationJobRequest = {
  clientRequestId: string
  problem: { sourcePoints: Point3[]; targetPoints: Point3[]; weights: number[] | null }
  solver: { allowReflection: boolean }
  target: 'gpu'
  timeoutSeconds: number
}

export type JobRequest = QuboIsingJobRequest | TensorNetworkJobRequest | GeometricRegistrationJobRequest

// The production envelope is deliberately limited to the largest benchmarked
// case. Increasing it requires new hardware evidence and a contract revision.
export const MAX_PROBLEM_SIZE = 256
export const MAX_INLINE_TERMS = 32_896 // upper triangle for n=256
export const MAX_JOB_TIMEOUT_SECONDS = 600
export const DEFAULT_JOB_TIMEOUT_SECONDS = 120
export const MAX_GEOMETRIC_POINTS = 16_384

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

function parseCommon(root: Record<string, unknown>) {
  const clientRequestId = typeof root.clientRequestId === 'string' ? root.clientRequestId.trim() : ''
  if (clientRequestId.length < 8 || clientRequestId.length > 120 || /[\r\n]/.test(clientRequestId)) {
    throw new JobValidationError('invalid_client_request_id', 'clientRequestId must contain 8–120 characters on one line.')
  }
  const rawTimeout = root.timeoutSeconds ?? DEFAULT_JOB_TIMEOUT_SECONDS
  if (!Number.isInteger(rawTimeout) || (rawTimeout as number) < 1 || (rawTimeout as number) > MAX_JOB_TIMEOUT_SECONDS) {
    throw new JobValidationError('invalid_timeout', `timeoutSeconds must be an integer from 1 to ${MAX_JOB_TIMEOUT_SECONDS}.`)
  }
  if (root.target !== undefined && root.target !== 'gpu') throw new JobValidationError('invalid_target', 'target must be "gpu".')
  return { clientRequestId, timeoutSeconds: rawTimeout as number, target: 'gpu' as const }
}

function parseBinaryProblem(root: Record<string, unknown>) {
  const problem = objectOf(root.problem)
  if (!problem || (problem.formulation !== 'qubo' && problem.formulation !== 'ising')) {
    throw new JobValidationError('invalid_problem', 'problem.formulation must be "qubo" or "ising".')
  }
  if (!Number.isInteger(problem.size) || (problem.size as number) < 1 || (problem.size as number) > MAX_PROBLEM_SIZE) {
    throw new JobValidationError('invalid_problem_size', `problem.size must be an integer from 1 to ${MAX_PROBLEM_SIZE}; larger sizes have not passed the hardware promotion gate.`)
  }
  if ('termsUrl' in problem) throw new JobValidationError('invalid_problem_terms', 'Remote term files are not supported; submit bounded inline terms.')
  const size = problem.size as number
  return { formulation: problem.formulation as ProblemFormulation, size, terms: parseTerms(problem.terms, size) }
}

export function parseTensorNetworkJobRequest(body: unknown): TensorNetworkJobRequest {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Request body must be a JSON object.')
  const common = parseCommon(root)
  const solver = objectOf(root.solver) ?? {}
  return {
    ...common,
    problem: parseBinaryProblem(root),
    solver: {
      bondDimension: boundedInteger(solver.bondDimension, 'bondDimension', 256, 2, 4096),
      exactThreshold: boundedInteger(solver.exactThreshold, 'exactThreshold', 18, 0, 18),
    },
  }
}

function parsePoints(value: unknown, field: string): Point3[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > MAX_GEOMETRIC_POINTS) {
    throw new JobValidationError('invalid_point_cloud', `${field} must contain 3–${MAX_GEOMETRIC_POINTS} three-dimensional points.`)
  }
  return value.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 3 || point.some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))) {
      throw new JobValidationError('invalid_point_cloud', `${field}[${index}] must contain three finite coordinates.`)
    }
    return [point[0], point[1], point[2]] as Point3
  })
}

export function parseGeometricRegistrationJobRequest(body: unknown): GeometricRegistrationJobRequest {
  const root = objectOf(body)
  if (!root) throw new JobValidationError('invalid_body', 'Request body must be a JSON object.')
  const common = parseCommon(root)
  const problem = objectOf(root.problem)
  if (!problem) throw new JobValidationError('invalid_problem', 'problem must be an object.')
  const sourcePoints = parsePoints(problem.sourcePoints, 'problem.sourcePoints')
  const targetPoints = parsePoints(problem.targetPoints, 'problem.targetPoints')
  if (sourcePoints.length !== targetPoints.length) throw new JobValidationError('invalid_point_cloud', 'Source and target point clouds must contain the same number of paired points.')
  let weights: number[] | null = null
  if (problem.weights !== undefined && problem.weights !== null) {
    if (!Array.isArray(problem.weights) || problem.weights.length !== sourcePoints.length || problem.weights.some((weight) => typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0)) {
      throw new JobValidationError('invalid_weights', 'problem.weights must contain one positive finite value per point pair.')
    }
    weights = problem.weights as number[]
  }
  const solver = objectOf(root.solver) ?? {}
  if (solver.allowReflection !== undefined && solver.allowReflection !== false) {
    throw new JobValidationError('invalid_solver', 'solver.allowReflection must be false; the production contract is limited to proper SE(3) rotations.')
  }
  return { ...common, problem: { sourcePoints, targetPoints, weights }, solver: { allowReflection: false } }
}

export const LEGACY_WORKER_CONTRACT_VERSION = '2.0.0'
export const WORKER_CONTRACT_VERSION = '3.0.0'

export type WorkerHandoff = {
  contractVersion: typeof WORKER_CONTRACT_VERSION
  jobId: string
  kind: JobKind
  callbackUrl: string
  timeoutSeconds: number
  expiresAt: string
  zeroDataRetention: boolean
  problem: JobRequest['problem']
  solver: JobRequest['solver']
  target: 'gpu'
  inputHash: string
}

export type BinaryOptimizationSolution = {
  objectiveValue: number
  assignment: number[]
  bestBound: number | null
  provenOptimal: boolean
}

export type GeometricRegistrationSolution = {
  rotation: [Point3, Point3, Point3]
  translation: Point3
  rmse: number
  maxError: number
  determinant: number
}

export type WorkerSolution = {
  objectiveValue?: number
  assignment?: number[]
  bestBound?: number | null
  provenOptimal?: boolean
  rotation?: [Point3, Point3, Point3]
  translation?: Point3
  rmse?: number
  maxError?: number
  determinant?: number
}

export type WorkerDiagnostics = {
  algorithm: 'exhaustive-enumeration' | 'parallel-update-simulated-annealing-torch-v1' | 'bounded-bond-transfer-contraction-torch-v1' | 'weighted-kabsch-svd-torch-v1'
  sweepsCompleted: number
  replicas: number | null
  acceptedMoves: number | null
  wallClockSeconds: number
  deviceClass: string
  bondDimension?: number
  peakFrontier?: number
  truncations?: number
  pointCount?: number
  reflectionCorrected?: boolean
  orthogonalityResidual?: number
  singularValues?: number[]
}

export type WorkerCallback = {
  contractVersion: typeof WORKER_CONTRACT_VERSION | typeof LEGACY_WORKER_CONTRACT_VERSION
  kind: JobKind
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
  if (root.contractVersion !== WORKER_CONTRACT_VERSION && root.contractVersion !== LEGACY_WORKER_CONTRACT_VERSION) throw new JobValidationError('unsupported_contract_version', `Worker callback contractVersion must be "${WORKER_CONTRACT_VERSION}".`)
  const kind = root.kind === undefined && root.contractVersion === LEGACY_WORKER_CONTRACT_VERSION ? 'qubo-ising' : root.kind
  if (!JOB_KINDS.includes(kind as JobKind)) throw new JobValidationError('invalid_job_kind', 'Callback kind is not supported.')
  if (root.contractVersion === LEGACY_WORKER_CONTRACT_VERSION && kind !== 'qubo-ising') throw new JobValidationError('unsupported_contract_version', 'Legacy callbacks are limited to QUBO/Ising jobs.')
  if (typeof root.jobId !== 'string' || !validJobId(root.jobId)) throw new JobValidationError('invalid_job_id', 'Callback jobId is malformed.')
  if (typeof root.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(root.inputHash)) throw new JobValidationError('invalid_input_hash', 'Callback inputHash must be a SHA-256 hex digest.')
  if (root.status !== 'completed' && root.status !== 'failed') throw new JobValidationError('invalid_status', 'Callback status must be "completed" or "failed".')
  if (root.status === 'failed') {
    const error = objectOf(root.error)
    if (!error || typeof error.code !== 'string' || typeof error.message !== 'string') throw new JobValidationError('invalid_error', 'A failed callback must carry error.code and error.message.')
    return { contractVersion: root.contractVersion, kind: kind as JobKind, jobId: root.jobId, inputHash: root.inputHash, status: 'failed', solution: null, diagnostics: null, error: { code: error.code.slice(0, 64), message: error.message.slice(0, 500) }, usage: parseUsage(root.usage) }
  }
  const solution = objectOf(root.solution)
  const diagnostics = objectOf(root.diagnostics)
  const algorithms = ['exhaustive-enumeration', 'parallel-update-simulated-annealing-torch-v1', 'bounded-bond-transfer-contraction-torch-v1', 'weighted-kabsch-svd-torch-v1']
  if (!diagnostics || !algorithms.includes(String(diagnostics.algorithm)) || typeof diagnostics.wallClockSeconds !== 'number' || !Number.isFinite(diagnostics.wallClockSeconds)) {
    throw new JobValidationError('invalid_diagnostics', 'Completed callbacks require bounded, recognized diagnostics.')
  }
  const validAlgorithm = kind === 'qubo-ising'
    ? ['exhaustive-enumeration', 'parallel-update-simulated-annealing-torch-v1'].includes(String(diagnostics.algorithm))
    : kind === 'tensor-network'
      ? ['exhaustive-enumeration', 'bounded-bond-transfer-contraction-torch-v1'].includes(String(diagnostics.algorithm))
      : diagnostics.algorithm === 'weighted-kabsch-svd-torch-v1'
  if (!validAlgorithm) throw new JobValidationError('invalid_diagnostics', 'The reported algorithm does not match the job kind.')
  let parsedSolution: WorkerSolution
  if (kind === 'geometric-registration') {
    const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    const point = (value: unknown): value is Point3 => Array.isArray(value) && value.length === 3 && value.every(finite)
    if (!solution || !Array.isArray(solution.rotation) || solution.rotation.length !== 3 || !solution.rotation.every(point) || !point(solution.translation) || !finite(solution.rmse) || !finite(solution.maxError) || !finite(solution.determinant) || (solution.rmse as number) < 0 || (solution.maxError as number) < 0) {
      throw new JobValidationError('invalid_solution', 'A geometric callback must carry a finite rigid transform and residuals.')
    }
    parsedSolution = { rotation: solution.rotation as [Point3, Point3, Point3], translation: solution.translation, rmse: solution.rmse as number, maxError: solution.maxError as number, determinant: solution.determinant as number }
  } else {
    if (!solution || typeof solution.objectiveValue !== 'number' || !Number.isFinite(solution.objectiveValue) || !Array.isArray(solution.assignment) || solution.assignment.some((value) => !Number.isInteger(value))) {
      throw new JobValidationError('invalid_solution', 'An optimization callback must carry a finite objective and integer assignment.')
    }
    const bestBound = solution.bestBound === null || solution.bestBound === undefined ? null : solution.bestBound
    if (bestBound !== null && (typeof bestBound !== 'number' || !Number.isFinite(bestBound))) throw new JobValidationError('invalid_solution', 'solution.bestBound must be finite or null.')
    parsedSolution = { objectiveValue: solution.objectiveValue, assignment: solution.assignment as number[], bestBound: bestBound as number | null, provenOptimal: solution.provenOptimal === true }
  }
  return {
    contractVersion: root.contractVersion,
    kind: kind as JobKind,
    jobId: root.jobId,
    inputHash: root.inputHash,
    status: 'completed',
    solution: parsedSolution,
    diagnostics: {
      algorithm: diagnostics.algorithm as WorkerDiagnostics['algorithm'],
      sweepsCompleted: Number.isInteger(diagnostics.sweepsCompleted) ? diagnostics.sweepsCompleted as number : 0,
      replicas: Number.isInteger(diagnostics.replicas) ? diagnostics.replicas as number : null,
      acceptedMoves: Number.isInteger(diagnostics.acceptedMoves) ? diagnostics.acceptedMoves as number : null,
      wallClockSeconds: diagnostics.wallClockSeconds,
      deviceClass: typeof diagnostics.deviceClass === 'string' ? diagnostics.deviceClass.slice(0, 64) : 'unspecified',
      bondDimension: Number.isInteger(diagnostics.bondDimension) ? diagnostics.bondDimension as number : undefined,
      peakFrontier: Number.isInteger(diagnostics.peakFrontier) ? diagnostics.peakFrontier as number : undefined,
      truncations: Number.isInteger(diagnostics.truncations) ? diagnostics.truncations as number : undefined,
      pointCount: Number.isInteger(diagnostics.pointCount) ? diagnostics.pointCount as number : undefined,
      reflectionCorrected: typeof diagnostics.reflectionCorrected === 'boolean' ? diagnostics.reflectionCorrected : undefined,
      orthogonalityResidual: typeof diagnostics.orthogonalityResidual === 'number' && Number.isFinite(diagnostics.orthogonalityResidual) ? diagnostics.orthogonalityResidual : undefined,
      singularValues: Array.isArray(diagnostics.singularValues) && diagnostics.singularValues.every((value) => typeof value === 'number' && Number.isFinite(value)) ? diagnostics.singularValues as number[] : undefined,
    },
    error: null,
    usage: parseUsage(root.usage),
  }
}
