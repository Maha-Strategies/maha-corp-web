import type { CapacityScenario } from './capacity-slo.ts'

/** Probe only credit-free readiness GETs, never MCP tools or paid operations. */
export async function capacityPreflight(options: {
  baseUrl: string
  scenarios: CapacityScenario[]
  timeoutMs: number
  fetcher?: typeof fetch
}) {
  const probes = []
  for (const scenario of options.scenarios.filter((s) => s.method === 'GET' && ['billing-readiness', 'observability-readiness'].includes(s.name))) {
    let status = 0
    try {
      const response = await (options.fetcher ?? fetch)(`${options.baseUrl}${scenario.path}`, {
        method: 'GET', headers: scenario.headers, redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs),
      })
      status = response.status
      await response.body?.cancel()
    } catch { /* A failed probe blocks the load run without exposing credentials or response bodies. */ }
    const failure = status === 401 || status === 403
      ? 'Readiness authorization rejected. Verify CAPACITY_RELEASE_HEALTH_TOKEN matches RELEASE_HEALTH_TOKEN on this exact Preview deployment; do not disable authorization.'
      : status < 200 || status >= 300 ? 'Readiness preflight failed. Inspect deployment configuration or availability before running capacity acceptance.' : null
    probes.push({ name: scenario.name, path: scenario.path, status, failure })
  }
  return probes
}
