// Whether autonomous agents are discovering this platform is the first
// question the machine-economy thesis depends on, and nothing measured it: the
// discovery documents were static files with no instrumentation.
//
// The tension is that answering it needs to know something about the caller,
// while the platform's standing rule is that no user agent, IP, or visitor
// identifier is ever stored. The resolution is to classify in memory and store
// only the class: seven possible values, aggregated per day. That is enough to
// tell a machine from a browser and nowhere near enough to identify anyone.

// What something evaluating this platform actually reads.
//
// Two surfaces are deliberately absent. /api/docs/openapi is requested by
// release health four times an hour and by the capacity harness on every run,
// so its counts would measure our own monitoring rather than agent interest.
// /llms.txt is served by a generated route that a stale public/llms.txt
// shadows; the two conflict, and making the route dynamic to meter it turns
// that latent conflict into a hard 500.
export const DISCOVERY_SURFACES = {
  agent_card: '/.well-known/agent.json',
  agent_offers: '/agent-offers.json',
  agent_context: '/llm-context/agentic-commerce.md',
  mcp_contract: '/mcp-gateway-contract.json',
} as const

export type DiscoverySurface = keyof typeof DISCOVERY_SURFACES

export const CLIENT_CLASSES = [
  'agent_runtime',  // an AI agent framework or MCP client calling on its own behalf
  'ai_crawler',     // an AI vendor's indexing or training crawler
  'search_crawler', // a conventional search engine crawler
  'http_client',    // a script or command-line tool
  'browser',        // a person looking at the document
  'unspecified',    // no user agent offered at all
  'other',
] as const

export type ClientClass = (typeof CLIENT_CLASSES)[number]

// Ordered: the first match wins, so the more specific families are tested
// before the generic ones. `Mozilla/5.0` is claimed by almost everything,
// including most crawlers, which is why browser detection comes last.
const SIGNATURES: readonly { class: ClientClass; patterns: RegExp }[] = [
  { class: 'ai_crawler', patterns: /\b(gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|google-extended|bytespider|meta-externalagent|applebot-extended)\b/ },
  { class: 'search_crawler', patterns: /\b(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebookexternalhit|twitterbot|linkedinbot|ahrefsbot|semrushbot)\b/ },
  { class: 'agent_runtime', patterns: /\b(mcp|modelcontextprotocol|langchain|llamaindex|autogpt|babyagi|crewai|openai|anthropic|claude|llm|agent|copilot|cursor|semantic-kernel|haystack)\b/ },
  { class: 'http_client', patterns: /\b(curl|wget|python-requests|python-urllib|httpx|aiohttp|node-fetch|undici|axios|got|okhttp|go-http-client|java|libwww-perl|powershell|postman|insomnia|guzzle|restsharp)\b/ },
  { class: 'browser', patterns: /\b(mozilla|chrome|safari|firefox|edge|opera|webkit)\b/ },
]

/**
 * Derived per request and immediately discarded. The user agent is read here
 * and never returned, logged, or persisted.
 */
export function classifyClient(userAgent: string | null | undefined): ClientClass {
  const normalized = userAgent?.trim().toLowerCase()
  if (!normalized) return 'unspecified'
  for (const signature of SIGNATURES) {
    if (signature.patterns.test(normalized)) return signature.class
  }
  return 'other'
}

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }> }

/**
 * Metering is best-effort and never changes what the caller receives. A
 * discovery document failing to serve because a meter write failed would be a
 * far worse outcome than a missing data point.
 */
export async function recordAgentDiscovery(
  ledger: Ledger,
  input: { surface: DiscoverySurface; userAgent: string | null | undefined },
) {
  const { error } = await ledger.rpc('record_agent_discovery', {
    p_surface: input.surface,
    p_client_class: classifyClient(input.userAgent),
    p_observed_at: new Date().toISOString(),
  })
  if (error) console.error('Agent discovery meter write failed:', error.code ?? 'unknown_error')
}

export type AgentDiscoveryUsageRow = {
  usage_day: string
  surface: DiscoverySurface
  client_class: ClientClass
  request_count: number | string
  last_observed_at?: string
}

function count(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Machine classes are the ones the machine-economy thesis is actually about. */
const MACHINE_CLASSES = new Set<ClientClass>(['agent_runtime', 'ai_crawler', 'http_client'])

export function aggregateAgentDiscovery(rows: AgentDiscoveryUsageRow[]) {
  const bySurface = new Map<string, { surface: string; path: string; requests: number; agentRuntimeRequests: number }>()
  const byClientClass = new Map<ClientClass, number>()
  let requests = 0
  let machineRequests = 0
  let agentRuntimeRequests = 0

  for (const row of rows) {
    const requestCount = count(row.request_count)
    requests += requestCount
    if (MACHINE_CLASSES.has(row.client_class)) machineRequests += requestCount
    if (row.client_class === 'agent_runtime') agentRuntimeRequests += requestCount
    byClientClass.set(row.client_class, (byClientClass.get(row.client_class) ?? 0) + requestCount)

    const current = bySurface.get(row.surface) ?? {
      surface: row.surface, path: DISCOVERY_SURFACES[row.surface] ?? row.surface, requests: 0, agentRuntimeRequests: 0,
    }
    current.requests += requestCount
    if (row.client_class === 'agent_runtime') current.agentRuntimeRequests += requestCount
    bySurface.set(row.surface, current)
  }

  return {
    requests,
    machineRequests,
    agentRuntimeRequests,
    // The headline the thesis rests on: what share of discovery traffic is a
    // machine rather than a person browsing.
    machineShare: requests === 0 ? null : machineRequests / requests,
    bySurface: [...bySurface.values()].sort((left, right) => right.requests - left.requests || left.surface.localeCompare(right.surface)),
    byClientClass: CLIENT_CLASSES
      .map((clientClass) => ({ clientClass, requests: byClientClass.get(clientClass) ?? 0 }))
      .filter((entry) => entry.requests > 0)
      .sort((left, right) => right.requests - left.requests),
  }
}
