import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JobValidationError,
  WORKER_CONTRACT_VERSION,
  createJobId,
  parseTensorOptJobRequest,
  parseWorkerCallback,
  validJobId,
} from '../lib/jobs/contract.ts'
import { quoteJobCredits } from '../lib/jobs/pricing.ts'

const baseRequest = {
  clientRequestId: 'req-12345678',
  problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 1, value: -1.5 }, { i: 2, j: 2, value: 3 }] },
  solver: { bondDimensionMax: 64, maxSweeps: 10, seed: 7 },
}

function assertRejects(body: unknown, code: string) {
  try {
    parseTensorOptJobRequest(body)
    assert.fail(`expected rejection with code ${code}`)
  } catch (error) {
    assert.ok(error instanceof JobValidationError)
    assert.equal(error.code, code)
  }
}

test('a well-formed tensor-opt request normalizes to the job contract', () => {
  const parsed = parseTensorOptJobRequest(baseRequest)
  assert.equal(parsed.problem.size, 4)
  assert.equal(parsed.problem.terms?.length, 2)
  assert.equal(parsed.target, 'gpu')
  assert.equal(parsed.timeoutSeconds, 3600)
  assert.equal(parsed.solver.truncationThreshold, null)
})

test('the v1 mock request shape still parses', () => {
  // variableCount/spinCount and target:{kind} were the v1 field names. Existing
  // integrations must not break on the migration to the real job engine.
  const parsed = parseTensorOptJobRequest({
    ...baseRequest,
    problem: { formulation: 'qubo', variableCount: 9, terms: [] },
    target: { kind: 'tpu' },
  })
  assert.equal(parsed.problem.size, 9)
  assert.equal(parsed.target, 'tpu')

  const ising = parseTensorOptJobRequest({
    ...baseRequest,
    problem: { formulation: 'ising', spinCount: 12, terms: [] },
  })
  assert.equal(ising.problem.size, 12)
})

test('an unrecognized target falls back to gpu rather than failing the request', () => {
  assert.equal(parseTensorOptJobRequest({ ...baseRequest, target: 'nonsense' }).target, 'gpu')
  assert.equal(parseTensorOptJobRequest({ ...baseRequest, target: 'tpu' }).target, 'tpu')
})

test('timeoutSeconds is clamped to the engine maximum', () => {
  assert.equal(parseTensorOptJobRequest({ ...baseRequest, timeoutSeconds: 999_999 }).timeoutSeconds, 21_600)
})

test('exactly one of terms and termsUrl is required', () => {
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4 } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [], termsUrl: 'https://x.test/t' } }, 'invalid_problem_terms')
})

test('term URLs must be HTTPS', () => {
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, termsUrl: 'http://x.test/t' } }, 'invalid_problem_terms')
})

test('terms must be upper-triangular and in range', () => {
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 3, j: 1, value: 1 }] } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 9, value: 1 }] } }, 'invalid_problem_terms')
})

test('non-finite coefficients are refused at the API boundary', () => {
  // NaN and Infinity serialize back out through JSON.stringify as null, so a
  // coefficient that reaches the worker would silently be a different problem.
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 1, value: Number.NaN }] } }, 'invalid_problem_terms')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 4, terms: [{ i: 0, j: 1, value: Number.POSITIVE_INFINITY }] } }, 'invalid_problem_terms')
})

test('malformed identifiers and solver settings are rejected', () => {
  assertRejects({ ...baseRequest, clientRequestId: 'short' }, 'invalid_client_request_id')
  assertRejects({ ...baseRequest, problem: { formulation: 'maxcut', size: 4, terms: [] } }, 'invalid_problem')
  assertRejects({ ...baseRequest, problem: { formulation: 'qubo', size: 0, terms: [] } }, 'invalid_problem_size')
  assertRejects({ ...baseRequest, solver: { bondDimensionMax: 0 } }, 'invalid_solver')
  assertRejects({ ...baseRequest, solver: { truncationThreshold: 1 } }, 'invalid_solver')
})

test('job ids round-trip through their validator', () => {
  const jobId = createJobId()
  assert.ok(validJobId(jobId))
  assert.equal(validJobId('audit_deadbeef'), false)
})

test('a completed worker callback parses with its diagnostics', () => {
  const callback = parseWorkerCallback({
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId: createJobId(),
    inputHash: 'a'.repeat(64),
    status: 'completed',
    solution: { objectiveValue: -12.5, assignment: [0, 1, 1, 0] },
    diagnostics: { wallClockSeconds: 42.1, discardedWeight: 1e-9, deviceClass: 'a100-80gb' },
    usage: { deviceSeconds: 40 },
  })

  assert.equal(callback.status, 'completed')
  assert.equal(callback.diagnostics?.discardedWeight, 1e-9)
  assert.equal(callback.usage?.deviceSeconds, 40)
})

test('optimality is never inferred from an absent field', () => {
  const callback = parseWorkerCallback({
    contractVersion: WORKER_CONTRACT_VERSION,
    jobId: createJobId(),
    inputHash: 'a'.repeat(64),
    status: 'completed',
    solution: { objectiveValue: 1, assignment: [0] },
    diagnostics: { wallClockSeconds: 1 },
  })

  assert.equal(callback.solution?.provenOptimal, false)
  assert.equal(callback.solution?.bestBound, null)
})

test('worker callbacks are rejected when the contract cannot be trusted', () => {
  const jobId = createJobId()
  const hash = 'a'.repeat(64)

  const cases: [unknown, string][] = [
    [{ contractVersion: '0.9.0', jobId, inputHash: hash, status: 'completed' }, 'unsupported_contract_version'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, jobId: 'nope', inputHash: hash, status: 'completed' }, 'invalid_job_id'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, jobId, inputHash: 'zz', status: 'completed' }, 'invalid_input_hash'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, jobId, inputHash: hash, status: 'failed' }, 'invalid_error'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, jobId, inputHash: hash, status: 'completed', solution: { objectiveValue: 1, assignment: [0] } }, 'invalid_diagnostics'],
    [{ contractVersion: WORKER_CONTRACT_VERSION, jobId, inputHash: hash, status: 'completed', solution: { objectiveValue: 1, assignment: [0, Number.NaN] }, diagnostics: { wallClockSeconds: 1 } }, 'invalid_solution'],
  ]

  for (const [body, code] of cases) {
    try {
      parseWorkerCallback(body)
      assert.fail(`expected rejection with code ${code}`)
    } catch (error) {
      assert.ok(error instanceof JobValidationError)
      assert.equal(error.code, code)
    }
  }
})

test('credit quotes scale with declared problem size', () => {
  assert.equal(quoteJobCredits('tensor-opt', 1), 525)
  assert.equal(quoteJobCredits('tensor-opt', 1000), 525)
  assert.equal(quoteJobCredits('tensor-opt', 1001), 550)
  assert.ok(quoteJobCredits('holographic-qec', 10_000) > quoteJobCredits('tensor-opt', 10_000))
})
