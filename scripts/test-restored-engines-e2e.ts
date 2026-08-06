import nextEnv from '@next/env'
import assert from 'node:assert/strict'

import { MahaClient } from '../lib/sdk/index.ts'

nextEnv.loadEnvConfig(process.cwd())
const baseUrl = process.env.TEST_API_URL
const apiKey = process.env.STAGING_API_KEY
if (!baseUrl?.startsWith('https://')) throw new Error('TEST_API_URL must be the HTTPS Preview deployment under test.')
if (!apiKey) throw new Error('STAGING_API_KEY must be a provisioned non-production key.')
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET!)
    return originalFetch(input, { ...init, headers })
  }
}

const maha = new MahaClient({ apiKey, baseUrl })
console.log(`Restored-engine staging E2E: ${baseUrl}`)

const tensorTerms = Array.from({ length: 64 }, (_, index) => ({ i: index, j: index, value: -1 }))
const tensorRequest = {
  clientRequestId: `tensor-e2e-${Date.now()}`,
  problem: { formulation: 'qubo' as const, size: 64, terms: tensorTerms },
  solver: { bondDimension: 256, exactThreshold: 0 }, target: 'gpu' as const, timeoutSeconds: 120,
}
const tensorSubmitted = await maha.optimization.submitTensorNetwork(tensorRequest)
const tensorReplay = await maha.optimization.submitTensorNetwork(tensorRequest)
assert.equal(tensorReplay.jobId, tensorSubmitted.jobId)
const tensor = await maha.optimization.solveTensorNetwork(tensorRequest, { pollIntervalMs: 500, timeoutMs: 120_000 })
assert.equal(tensor.jobId, tensorSubmitted.jobId)
assert.equal(tensor.diagnostics?.algorithm, 'bounded-bond-transfer-contraction-torch-v1')
assert.deepEqual(tensor.result?.assignment, Array(64).fill(1))
assert.equal(tensor.result?.objectiveValue, -64)
assert.equal(tensor.result?.provenOptimal, false)
assert.equal(tensor.credits.charged, 800)
console.log(`✔ tensor-network result and idempotency verified: ${tensor.jobId}`)

const source = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] as [number, number, number][]
const target = [[2, -1, 3], [2, 0, 3], [1, -1, 3], [2, -1, 4]] as [number, number, number][]
const geometricRequest = {
  clientRequestId: `geometric-e2e-${Date.now()}`,
  problem: { sourcePoints: source, targetPoints: target },
  solver: { allowReflection: false }, target: 'gpu' as const, timeoutSeconds: 120,
}
const geometricSubmitted = await maha.optimization.submitGeometricRegistration(geometricRequest)
const geometricReplay = await maha.optimization.submitGeometricRegistration(geometricRequest)
assert.equal(geometricReplay.jobId, geometricSubmitted.jobId)
const geometric = await maha.optimization.solveGeometricRegistration(geometricRequest, { pollIntervalMs: 500, timeoutMs: 120_000 })
assert.equal(geometric.jobId, geometricSubmitted.jobId)
assert.equal(geometric.diagnostics?.algorithm, 'weighted-kabsch-svd-torch-v1')
assert.ok((geometric.result?.rmse ?? 1) < 1e-9)
assert.ok(Math.abs((geometric.result?.determinant ?? 0) - 1) < 1e-9)
assert.equal(geometric.credits.charged, 525)
console.log(`✔ geometric transform, signed callback, and idempotency verified: ${geometric.jobId}`)
