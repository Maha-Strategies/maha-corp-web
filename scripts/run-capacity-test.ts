import nextEnv from '@next/env'
import { writeFile } from 'node:fs/promises'

import { capacityConfiguration, capacityFailures, capacityReport, capacityScenarios, type CapacityScenario } from '../lib/capacity-slo.ts'

nextEnv.loadEnvConfig(process.cwd())

const environment = {
  ...process.env,
  CAPACITY_BASE_URL: process.env.CAPACITY_BASE_URL || process.env.TEST_API_URL,
  CAPACITY_API_KEY: process.env.CAPACITY_API_KEY || process.env.STAGING_API_KEY,
  CAPACITY_RELEASE_HEALTH_TOKEN: process.env.CAPACITY_RELEASE_HEALTH_TOKEN || process.env.RELEASE_HEALTH_TOKEN,
}
const configuration = capacityConfiguration(environment)
const scenarios = capacityScenarios(environment, configuration.profile)

async function execute(scenario: CapacityScenario) {
  const latencies: number[] = []
  const statuses: number[] = []
  let cursor = 0
  const started = performance.now()
  await Promise.all(Array.from({ length: configuration.concurrency }, async () => {
    while (true) {
      const index = cursor++
      if (index >= configuration.requestsPerScenario) return
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
  return capacityReport({ scenario, latencies, statuses, elapsedMs: performance.now() - started })
}

const reports = []
for (const scenario of scenarios) reports.push(await execute(scenario))
const failures = capacityFailures(reports, configuration.thresholds)
const output = {
  schema: 'maha.capacity-report.v1', generatedAt: new Date().toISOString(), targetOrigin: configuration.baseUrl,
  production: configuration.production, profile: configuration.profile, requestsPerScenario: configuration.requestsPerScenario,
  concurrency: configuration.concurrency, timeoutMs: configuration.timeoutMs, thresholds: configuration.thresholds,
  state: failures.length ? 'failed' : 'passed', reports, failures,
}
await writeFile(process.env.CAPACITY_OUTPUT_PATH?.trim() || 'capacity-report.json', `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 })
console.log(JSON.stringify({ state: output.state, profile: output.profile, reports: reports.map(({ name, requests, successRate, throughputPerSecond, latencyMs }) => ({ name, requests, successRate, throughputPerSecond, latencyMs })), failures }, null, 2))
if (failures.length) throw new Error(`Capacity acceptance failed: ${failures.join('; ')}.`)
