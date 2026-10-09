import nextEnv from '@next/env'
import { writeFile } from 'node:fs/promises'

import { capacityConfiguration, capacityFailures, capacityReport, capacityScenarios, type CapacityScenario } from '../lib/capacity-slo.ts'
import { capacityPreflight } from '../lib/capacity-preflight.ts'

nextEnv.loadEnvConfig(process.cwd())

const environment = {
  ...process.env,
  CAPACITY_BASE_URL: process.env.CAPACITY_BASE_URL || process.env.TEST_API_URL,
  CAPACITY_API_KEY: process.env.CAPACITY_API_KEY || process.env.STAGING_API_KEY,
  CAPACITY_RELEASE_HEALTH_TOKEN: process.env.CAPACITY_RELEASE_HEALTH_TOKEN || process.env.RELEASE_HEALTH_TOKEN,
}
const configuration = capacityConfiguration(environment)
const scenarios = capacityScenarios(environment, configuration.profile)
const outputPath = process.env.CAPACITY_OUTPUT_PATH?.trim() || 'capacity-report.json'
const preflight = await capacityPreflight({ baseUrl: configuration.baseUrl, scenarios, timeoutMs: configuration.timeoutMs })
const preflightFailures = preflight.filter((probe) => probe.failure).map((probe) => `${probe.name}: HTTP ${probe.status || 'unavailable'}: ${probe.failure}`)
if (preflightFailures.length) {
  const blocked = { schema: 'maha.capacity-report.v1', generatedAt: new Date().toISOString(), targetOrigin: configuration.baseUrl,
    production: configuration.production, profile: configuration.profile, state: 'blocked', preflight, reports: [], failures: preflightFailures }
  await writeFile(outputPath, `${JSON.stringify(blocked, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify(blocked, null, 2))
  throw new Error('Capacity run blocked by readiness preflight; no load batches were started.')
}

async function batch(scenario: CapacityScenario, requests: number) {
  const latencies: number[] = []
  const statuses: number[] = []
  let cursor = 0
  const started = performance.now()
  await Promise.all(Array.from({ length: configuration.concurrency }, async () => {
    while (true) {
      const index = cursor++
      if (index >= requests) return
      const requestStarted = performance.now()
      let status = 0
      try {
        const response = await fetch(`${configuration.baseUrl}${scenario.path}`, {
          method: scenario.method, headers: scenario.headers, body: scenario.body,
          signal: AbortSignal.timeout(configuration.timeoutMs), redirect: 'manual',
        })
        status = response.status
        await response.body?.cancel()
      } catch { status = 0 }
      latencies.push(Math.round((performance.now() - requestStarted) * 100) / 100)
      statuses.push(status)
    }
  }))
  return { latencies, statuses, elapsedMs: performance.now() - started }
}

async function execute(scenario: CapacityScenario) {
  const warmup = await batch(scenario, configuration.concurrency)
  const measured = await batch(scenario, configuration.requestsPerScenario)
  return capacityReport({ scenario, ...measured, warmupLatencies: warmup.latencies, warmupStatuses: warmup.statuses })
}

const reports = []
for (const scenario of scenarios) reports.push(await execute(scenario))
const failures = capacityFailures(reports, configuration.thresholds)
const output = {
  schema: 'maha.capacity-report.v1', generatedAt: new Date().toISOString(), targetOrigin: configuration.baseUrl,
  production: configuration.production, profile: configuration.profile, requestsPerScenario: configuration.requestsPerScenario,
  concurrency: configuration.concurrency, timeoutMs: configuration.timeoutMs, thresholds: configuration.thresholds,
  warmupRequestsPerScenario: configuration.concurrency, state: failures.length ? 'failed' : 'passed', preflight, reports, failures,
}
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 })
console.log(JSON.stringify({ state: output.state, profile: output.profile, reports: reports.map(({ name, requests, successRate, throughputPerSecond, latencyMs, warmup }) => ({ name, requests, successRate, throughputPerSecond, latencyMs, warmup })), failures }, null, 2))
if (failures.length) throw new Error(`Capacity acceptance failed: ${failures.join('; ')}.`)
