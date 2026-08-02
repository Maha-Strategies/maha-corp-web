export type CapacityProfile = 'public' | 'control-plane' | 'mcp'
type Environment = Readonly<Record<string, string | undefined>>

export type CapacityScenario = {
  name: string
  path: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

export type CapacityScenarioReport = {
  name: string
  path: string
  requests: number
  successes: number
  successRate: number
  throughputPerSecond: number
  latencyMs: { min: number; p50: number; p95: number; p99: number; max: number }
  statuses: Record<string, number>
  warmup: { requests: number; successes: number; maxLatencyMs: number; statuses: Record<string, number> }
}

export const CAPACITY_THRESHOLDS: Record<CapacityProfile, { minSuccessRate: number; maxP95Ms: number; maxP99Ms: number; maxWarmupMs: number }> = Object.freeze({
  public: { minSuccessRate: 0.999, maxP95Ms: 1_000, maxP99Ms: 2_500, maxWarmupMs: 3_000 },
  'control-plane': { minSuccessRate: 0.999, maxP95Ms: 1_500, maxP99Ms: 3_000, maxWarmupMs: 5_000 },
  mcp: { minSuccessRate: 0.995, maxP95Ms: 3_000, maxP99Ms: 7_000, maxWarmupMs: 10_000 },
})

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number, name: string) {
  const parsed = value === undefined || value === '' ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`)
  return parsed
}

function secret(value: string | undefined, name: string) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${name} is required for this capacity profile.`)
  return normalized
}

export function capacityConfiguration(environment: Environment) {
  const rawUrl = secret(environment.CAPACITY_BASE_URL, 'CAPACITY_BASE_URL')
  const baseUrl = new URL(rawUrl)
  const local = baseUrl.hostname === 'localhost' || baseUrl.hostname === '127.0.0.1'
  if (baseUrl.protocol !== 'https:' && !local) throw new Error('CAPACITY_BASE_URL must use HTTPS outside localhost.')
  if (baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) throw new Error('CAPACITY_BASE_URL must be an origin without credentials, path, query, or fragment.')
  const production = baseUrl.hostname === 'www.mahastrategies.com' || baseUrl.hostname === 'mahastrategies.com'
  if (production && environment.CAPACITY_PRODUCTION_CONFIRMATION !== 'LOAD TEST PRODUCTION') throw new Error('Production capacity tests require CAPACITY_PRODUCTION_CONFIRMATION=LOAD TEST PRODUCTION.')
  const profile = environment.CAPACITY_PROFILE?.trim() || 'control-plane'
  if (!['public', 'control-plane', 'mcp'].includes(profile)) throw new Error('CAPACITY_PROFILE must be public, control-plane, or mcp.')
  const typedProfile = profile as CapacityProfile
  const requestsPerScenario = integer(environment.CAPACITY_REQUESTS_PER_SCENARIO, typedProfile === 'mcp' ? 20 : 40, 10, typedProfile === 'mcp' ? 30 : 500, 'CAPACITY_REQUESTS_PER_SCENARIO')
  const concurrency = integer(environment.CAPACITY_CONCURRENCY, typedProfile === 'mcp' ? 2 : 5, 1, typedProfile === 'mcp' ? 5 : 20, 'CAPACITY_CONCURRENCY')
  const timeoutMs = integer(environment.CAPACITY_TIMEOUT_MS, 10_000, 1_000, 30_000, 'CAPACITY_TIMEOUT_MS')
  if (typedProfile === 'mcp' && environment.CAPACITY_CREDIT_CONFIRMATION !== 'CONSUME CANARY CREDITS') throw new Error('MCP capacity tests require CAPACITY_CREDIT_CONFIRMATION=CONSUME CANARY CREDITS.')
  return { baseUrl: baseUrl.origin, production, profile: typedProfile, requestsPerScenario, concurrency, timeoutMs, thresholds: CAPACITY_THRESHOLDS[typedProfile] }
}

export function capacityScenarios(environment: Environment, profile: CapacityProfile): CapacityScenario[] {
  const bypass = environment.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
  const commonHeaders = bypass ? { 'x-vercel-protection-bypass': bypass } : undefined
  const scenarios: CapacityScenario[] = [
    { name: 'homepage', path: '/', method: 'GET', headers: commonHeaders },
    { name: 'openapi', path: '/api/docs/openapi', method: 'GET', headers: commonHeaders },
  ]
  if (profile === 'public') return scenarios
  const apiKey = secret(environment.CAPACITY_API_KEY, 'CAPACITY_API_KEY')
  if (profile === 'control-plane') {
    const releaseToken = secret(environment.CAPACITY_RELEASE_HEALTH_TOKEN, 'CAPACITY_RELEASE_HEALTH_TOKEN')
    const protectedHeaders = { ...commonHeaders, Authorization: `Bearer ${releaseToken}` }
    return [
      ...scenarios,
      { name: 'billing-readiness', path: '/api/admin/billing-readiness', method: 'GET', headers: protectedHeaders },
      { name: 'observability-readiness', path: '/api/admin/observability-readiness', method: 'GET', headers: protectedHeaders },
      { name: 'upstash-balance', path: '/api/v1/keys/balance', method: 'GET', headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}` } },
    ]
  }
  const serverId = secret(environment.CAPACITY_MCP_SERVER_ID, 'CAPACITY_MCP_SERVER_ID')
  if (!/^mcp_srv_[a-f0-9]{16}$/.test(serverId)) throw new Error('CAPACITY_MCP_SERVER_ID is invalid.')
  return [{
    name: 'mcp-controlled-upstream', path: `/api/v1/mcp/gateway/${serverId}`, method: 'POST',
    headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'capacity_probe', method: 'tools/calculateRiskScore', params: { portfolioId: 'capacity_canary', alpha: 0.05 } }),
  }]
}

export function percentile(sortedValues: number[], quantile: number) {
  if (!sortedValues.length) return 0
  return sortedValues[Math.max(0, Math.ceil(sortedValues.length * quantile) - 1)]
}

export function capacityReport(input: { scenario: CapacityScenario; latencies: number[]; statuses: number[]; elapsedMs: number; warmupLatencies?: number[]; warmupStatuses?: number[] }): CapacityScenarioReport {
  const sorted = [...input.latencies].sort((a, b) => a - b)
  const successes = input.statuses.filter((status) => status >= 200 && status < 300).length
  const statuses: Record<string, number> = {}
  for (const status of input.statuses) statuses[String(status)] = (statuses[String(status)] ?? 0) + 1
  const warmupStatuses: Record<string, number> = {}
  for (const status of input.warmupStatuses ?? []) warmupStatuses[String(status)] = (warmupStatuses[String(status)] ?? 0) + 1
  const round = (value: number) => Math.round(value * 100) / 100
  const roundRate = (value: number) => Math.round(value * 1_000_000) / 1_000_000
  return {
    name: input.scenario.name, path: input.scenario.path, requests: input.statuses.length, successes,
    successRate: roundRate(successes / input.statuses.length), throughputPerSecond: round(input.statuses.length / Math.max(input.elapsedMs / 1_000, 0.001)),
    latencyMs: { min: round(sorted[0] ?? 0), p50: round(percentile(sorted, 0.5)), p95: round(percentile(sorted, 0.95)), p99: round(percentile(sorted, 0.99)), max: round(sorted.at(-1) ?? 0) },
    statuses, warmup: {
      requests: input.warmupStatuses?.length ?? 0,
      successes: input.warmupStatuses?.filter((status) => status >= 200 && status < 300).length ?? 0,
      maxLatencyMs: round(Math.max(0, ...(input.warmupLatencies ?? []))), statuses: warmupStatuses,
    },
  }
}

export function capacityFailures(reports: CapacityScenarioReport[], thresholds: { minSuccessRate: number; maxP95Ms: number; maxP99Ms: number; maxWarmupMs: number }) {
  return reports.flatMap((report) => [
    ...(report.warmup.successes !== report.warmup.requests ? [`${report.name}: warmup requests did not all succeed`] : []),
    ...(report.warmup.maxLatencyMs > thresholds.maxWarmupMs ? [`${report.name}: warmup max ${report.warmup.maxLatencyMs}ms exceeds ${thresholds.maxWarmupMs}ms`] : []),
    ...(report.successRate < thresholds.minSuccessRate ? [`${report.name}: success rate ${report.successRate} is below ${thresholds.minSuccessRate}`] : []),
    ...(report.latencyMs.p95 > thresholds.maxP95Ms ? [`${report.name}: p95 ${report.latencyMs.p95}ms exceeds ${thresholds.maxP95Ms}ms`] : []),
    ...(report.latencyMs.p99 > thresholds.maxP99Ms ? [`${report.name}: p99 ${report.latencyMs.p99}ms exceeds ${thresholds.maxP99Ms}ms`] : []),
  ])
}
