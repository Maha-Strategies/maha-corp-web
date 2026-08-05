import nextEnv from '@next/env'
import assert from 'node:assert/strict'

import { MahaClient } from '../lib/sdk/index.ts'

nextEnv.loadEnvConfig(process.cwd())

const baseUrl = process.env.TEST_API_URL
const apiKey = process.env.STAGING_API_KEY
if (!baseUrl?.startsWith('https://')) throw new Error('TEST_API_URL must be the HTTPS Preview deployment under test.')
if (!apiKey) throw new Error('STAGING_API_KEY must be a provisioned non-production key.')

if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  const fetchWithoutBypass = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET!)
    return fetchWithoutBypass(input, { ...init, headers })
  }
}

const maha = new MahaClient({ apiKey, baseUrl })
const terms = Array.from({ length: 64 }, (_, index) => ({ i: index, j: index, value: -1 }))
const request = {
  clientRequestId: `qubo-e2e-${Date.now()}`,
  problem: { formulation: 'qubo' as const, size: 64, terms },
  solver: { maxSweeps: 64, replicas: 64, seed: 20260805, exactThreshold: 0 },
  target: 'gpu' as const,
  timeoutSeconds: 120,
}

console.log(`QUBO/Ising staging E2E: ${baseUrl}`)
const submitted = await maha.optimization.submitQuboIsing(request)
assert.equal(submitted.kind, 'qubo-ising')
assert.equal(submitted.status, 'queued')
assert.equal(submitted.acceptedConfiguration.problemSize, 64)
console.log(`✔ queued ${submitted.jobId}`)

const replay = await maha.optimization.submitQuboIsing(request)
assert.equal(replay.jobId, submitted.jobId, 'idempotent replay created a second job')
console.log('✔ idempotent replay returned the original job')

const completed = await maha.optimization.solveQuboIsing(request, { pollIntervalMs: 500, timeoutMs: 120_000 })
assert.equal(completed.jobId, submitted.jobId)
assert.equal(completed.status, 'completed')
assert.equal(completed.result?.provenOptimal, false)
assert.equal(completed.result?.bestBound, null)
assert.equal(completed.diagnostics?.algorithm, 'parallel-update-simulated-annealing-torch-v1')
assert.equal(completed.result?.assignment.length, 64)
assert.ok(completed.result?.assignment.every((value) => value === 1))
const objective = completed.result!.assignment.reduce((total, value, index) => total + terms[index].value * value, 0)
assert.equal(completed.result?.objectiveValue, objective)
assert.equal(objective, -64)
assert.equal(completed.credits.charged, 525)
assert.equal(completed.credits.refunded, 0)
console.log(`✔ Modal result verified: objective=${objective}, algorithm=${completed.diagnostics?.algorithm}`)
console.log(`✔ signed callback settled ${completed.credits.charged} credits exactly once`)
