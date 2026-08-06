import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JobValidationError,
  WORKER_CONTRACT_VERSION,
  createJobId,
  parseGeometricRegistrationJobRequest,
  parseQuboIsingJobRequest,
  parseTensorNetworkJobRequest,
  parseWorkerCallback,
  validJobId,
} from '../lib/jobs/contract.ts'
import { quoteJobCredits } from '../lib/jobs/pricing.ts'

const baseRequest = {
  clientRequestId: 'req-12345678',
  problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 1, value: -1.5 }, { i: 2, j: 2, value: 3 }] },
  solver: { maxSweeps: 64, replicas: 64, seed: 7, exactThreshold: 18 },
}

function assertRejects(body: unknown, code: string) {
  assert.throws(() => parseQuboIsingJobRequest(body), (error: unknown) => error instanceof JobValidationError && error.code === code)
}

test('a bounded QUBO request normalizes to the promoted contract', () => {
  const parsed = parseQuboIsingJobRequest(baseRequest)
  assert.equal(parsed.problem.size, 4)
  assert.equal(parsed.problem.terms.length, 2)
  assert.equal(parsed.target, 'gpu')
  assert.equal(parsed.timeoutSeconds, 120)
  assert.equal(parsed.solver.finalTemperature, null)
})

test('the public contract is limited to benchmarked sizes and inline data', () => {
  assertRejects({ ...baseRequest, problem: { ...baseRequest.problem, size: 257 } }, 'invalid_problem_size')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, termsUrl: 'https://example.com/q.json' } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, target: 'tpu' }, 'invalid_target')
})

test('solver controls are bounded and an annealing schedule cannot heat up', () => {
  assertRejects({ ...baseRequest, solver: { maxSweeps: 257 } }, 'invalid_solver')
  assertRejects({ ...baseRequest, solver: { replicas: 0 } }, 'invalid_solver')
  assertRejects({ ...baseRequest, solver: { exactThreshold: 19 } }, 'invalid_solver')
  assertRejects({ ...baseRequest, solver: { initialTemperature: 1, finalTemperature: 2 } }, 'invalid_solver')
})

test('terms are finite, nonempty, upper-triangular, and in range', () => {
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [] } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 3, j: 1, value: 1 }] } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 9, value: 1 }] } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 1, value: Number.NaN }] } }, 'invalid_problem_terms')
})

test('identifiers and timeout are bounded rather than silently rewritten', () => {
  assertRejects({ ...baseRequest, clientRequestId: 'short' }, 'invalid_client_request_id')
  assertRejects({ ...baseRequest, timeoutSeconds: 601 }, 'invalid_timeout')
  const jobId = createJobId()
  assert.ok(validJobId(jobId))
  assert.equal(validJobId('audit_deadbeef'), false)
})

test('a completed heuristic callback carries accurate method diagnostics', () => {
  const callback = parseWorkerCallback({
    contractVersion: WORKER_CONTRACT_VERSION,
    kind: 'qubo-ising',
    jobId: createJobId(), inputHash: 'a'.repeat(64), status: 'completed',
    solution: { objectiveValue: -12.5, assignment: [0, 1, 1, 0], bestBound: null, provenOptimal: false },
    diagnostics: { algorithm: 'parallel-update-simulated-annealing-torch-v1', sweepsCompleted: 64, replicas: 64, acceptedMoves: 123, wallClockSeconds: 0.025, deviceClass: 'NVIDIA A10' },
    usage: { deviceSeconds: 0.025 },
  })
  assert.equal(callback.diagnostics?.algorithm, 'parallel-update-simulated-annealing-torch-v1')
  assert.equal(callback.solution?.provenOptimal, false)
  assert.equal(callback.solution?.bestBound, null)
})

test('worker callbacks fail closed when identity, result, or method cannot be trusted', () => {
  const jobId = createJobId(); const inputHash = 'a'.repeat(64)
  const cases: [unknown, string][] = [
    [{ contractVersion: '1.0.0', jobId, inputHash, status: 'completed' }, 'unsupported_contract_version'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, kind: 'qubo-ising', jobId: 'nope', inputHash, status: 'completed' }, 'invalid_job_id'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, kind: 'qubo-ising', jobId, inputHash: 'zz', status: 'completed' }, 'invalid_input_hash'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, kind: 'qubo-ising', jobId, inputHash, status: 'failed' }, 'invalid_error'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, kind: 'qubo-ising', jobId, inputHash, status: 'completed', solution: { objectiveValue: 1, assignment: [0] }, diagnostics: { algorithm: 'made-up', sweepsCompleted: 1, wallClockSeconds: 1 } }, 'invalid_diagnostics'],
  ]
  for (const [body, code] of cases) assert.throws(() => parseWorkerCallback(body), (error: unknown) => error instanceof JobValidationError && error.code === code)
})

test('credit quote is fixed from declared bounded size', () => {
  assert.equal(quoteJobCredits('qubo-ising', 1), 525)
  assert.equal(quoteJobCredits('qubo-ising', 256), 525)
  assert.equal(quoteJobCredits('tensor-network', 256), 800)
  assert.equal(quoteJobCredits('geometric-registration', 1001), 550)
})

test('tensor-network requests expose a bounded contraction frontier', () => {
  const parsed = parseTensorNetworkJobRequest({ ...baseRequest, solver: { bondDimension: 512, exactThreshold: 12 } })
  assert.equal(parsed.solver.bondDimension, 512)
  assert.throws(() => parseTensorNetworkJobRequest({ ...baseRequest, solver: { bondDimension: 1 } }), (error: unknown) => error instanceof JobValidationError && error.code === 'invalid_solver')
})

test('geometric registration accepts paired finite points and positive weights', () => {
  const parsed = parseGeometricRegistrationJobRequest({
    clientRequestId: 'geo-12345678',
    problem: { sourcePoints: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], targetPoints: [[2, 3, 4], [3, 3, 4], [2, 4, 4]], weights: [1, 2, 1] },
  })
  assert.equal(parsed.problem.sourcePoints.length, 3)
  assert.equal(parsed.solver.allowReflection, false)
  assert.throws(() => parseGeometricRegistrationJobRequest({ clientRequestId: 'geo-12345678', problem: { sourcePoints: [[0, 0, 0]], targetPoints: [[0, 0, 0]] } }), (error: unknown) => error instanceof JobValidationError && error.code === 'invalid_point_cloud')
})

test('geometric callbacks validate transform shape and residuals', () => {
  const callback = parseWorkerCallback({
    contractVersion: WORKER_CONTRACT_VERSION, kind: 'geometric-registration', jobId: createJobId(), inputHash: 'b'.repeat(64), status: 'completed',
    solution: { rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], translation: [1, 2, 3], rmse: 0, maxError: 0, determinant: 1 },
    diagnostics: { algorithm: 'weighted-kabsch-svd-torch-v1', pointCount: 3, reflectionCorrected: false, orthogonalityResidual: 0, singularValues: [1, 1, 0], wallClockSeconds: 0.01, deviceClass: 'NVIDIA A10' },
  })
  assert.equal(callback.kind, 'geometric-registration')
  assert.equal(callback.solution?.rmse, 0)
})
