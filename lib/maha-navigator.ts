import { createHash, randomUUID } from 'node:crypto'

export const NAVIGATOR_PROTOCOLS = ['mcp', 'a2a', 'x402', 'api_tools', 'other'] as const
export const NAVIGATOR_STAGES = ['exploring', 'pilot', 'production'] as const
export const NAVIGATOR_CONTROL_STATES = ['unknown', 'absent', 'partial', 'enforced'] as const
export const NAVIGATOR_DOMAINS = ['tool_authorization', 'agent_identity', 'task_budgets', 'audit_receipts', 'context_governance', 'reliability'] as const
export const NAVIGATOR_PRIORITIES = ['tool_governance', 'payment_safety', 'context_cost', 'auditability', 'reliability'] as const

export type NavigatorProtocol = typeof NAVIGATOR_PROTOCOLS[number]
export type NavigatorStage = typeof NAVIGATOR_STAGES[number]
export type NavigatorControlState = typeof NAVIGATOR_CONTROL_STATES[number]
export type NavigatorDomain = typeof NAVIGATOR_DOMAINS[number]
export type NavigatorPriority = typeof NAVIGATOR_PRIORITIES[number]

export type NavigatorSubmission = {
  idempotencyKey: string
  requester: { name: string; email: string; organization: string; role: string }
  stage: NavigatorStage
  protocols: NavigatorProtocol[]
  priority: NavigatorPriority
  primaryGoal: string
  controls: Record<NavigatorDomain, NavigatorControlState>
  consentToAssessment: true
  consentToFollowUp: boolean
}

export type NavigatorAssessment = {
  schemaVersion: 'maha-navigator/0.1'
  score: number
  band: 'foundational' | 'developing' | 'controlled'
  gaps: { domain: NavigatorDomain; status: NavigatorControlState; priority: 'high' | 'medium'; action: string }[]
  strengths: NavigatorDomain[]
  recommendedPilot: { id: 'governed-agent-gateway' | 'x402-buyer-policy' | 'context-compiler' | 'reliability-review'; name: string; objective: string }
  pilotCandidate: boolean
  limits: string[]
}

const ACTIONS: Record<NavigatorDomain, string> = {
  tool_authorization: 'Define an explicit tool and skill allowlist, including the actor permitted to change it.',
  agent_identity: 'Bind each agent or workload to a distinct identity with scoped, revocable credentials.',
  task_budgets: 'Set per-call and cumulative task ceilings before an agent can authorize paid actions.',
  audit_receipts: 'Record decision inputs, policy results, upstream calls, payment receipts, and accountable actors.',
  context_governance: 'Define context sources, retention boundaries, provenance requirements, and token budgets.',
  reliability: 'Set upstream timeouts, circuit-breaker behavior, failure alerts, and a tested recovery path.',
}

const SCORE: Record<NavigatorControlState, number> = { unknown: 0, absent: 0, partial: 1, enforced: 2 }

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

function text(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max) throw new Error(`${name} must contain between ${min} and ${max} characters.`)
  return parsed
}

function member<T extends readonly string[]>(value: unknown, values: T, name: string): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`${name} is not supported.`)
  return value as T[number]
}

export function parseNavigatorSubmission(value: unknown): NavigatorSubmission {
  const body = object(value, 'Request body')
  if (body.website) throw new Error('Submission rejected.')
  const requester = object(body.requester, 'requester')
  const email = line(requester.email, 'requester.email', 5, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('requester.email must be a valid email address.')
  if (body.consentToAssessment !== true) throw new Error('consentToAssessment must be true before an assessment can be created.')
  if (typeof body.consentToFollowUp !== 'boolean') throw new Error('consentToFollowUp must be true or false.')
  if (!Array.isArray(body.protocols) || body.protocols.length < 1 || body.protocols.length > NAVIGATOR_PROTOCOLS.length) throw new Error('protocols must contain between one and five supported values.')
  const protocols = [...new Set(body.protocols.map((item) => member(item, NAVIGATOR_PROTOCOLS, 'protocols item')))]
  const rawControls = object(body.controls, 'controls')
  const controls = Object.fromEntries(NAVIGATOR_DOMAINS.map((domain) => [domain, member(rawControls[domain], NAVIGATOR_CONTROL_STATES, `controls.${domain}`)])) as Record<NavigatorDomain, NavigatorControlState>
  return {
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120),
    requester: {
      name: line(requester.name, 'requester.name', 2, 120), email,
      organization: line(requester.organization, 'requester.organization', 2, 160),
      role: line(requester.role, 'requester.role', 2, 120),
    },
    stage: member(body.stage, NAVIGATOR_STAGES, 'stage'), protocols,
    priority: member(body.priority, NAVIGATOR_PRIORITIES, 'priority'),
    primaryGoal: text(body.primaryGoal, 'primaryGoal', 20, 1_500), controls,
    consentToAssessment: true, consentToFollowUp: body.consentToFollowUp,
  }
}

function recommendation(input: Pick<NavigatorSubmission, 'protocols' | 'priority'>): NavigatorAssessment['recommendedPilot'] {
  if (input.priority === 'payment_safety' || input.protocols.includes('x402')) return { id: 'x402-buyer-policy', name: 'Bounded agent-payment policy pilot', objective: 'Apply payee, network, asset, per-call, and cumulative task controls to one real agent purchase flow.' }
  if (input.priority === 'context_cost') return { id: 'context-compiler', name: 'Context-retention workload pilot', objective: 'Compile one representative multi-source workload to a fixed token budget and measure retention, provenance, latency, and cost avoided.' }
  if (input.priority === 'reliability') return { id: 'reliability-review', name: 'Agent dependency reliability review', objective: 'Exercise one upstream failure path and define its timeout, circuit-breaker, alerting, and recovery evidence.' }
  return { id: 'governed-agent-gateway', name: 'Governed MCP/A2A compatibility pilot', objective: 'Proxy one real agent and one tool server through an allowlisted, tenant-isolated, auditable policy boundary.' }
}

export function buildNavigatorAssessment(input: NavigatorSubmission): NavigatorAssessment {
  const points = NAVIGATOR_DOMAINS.reduce((total, domain) => total + SCORE[input.controls[domain]], 0)
  const score = Math.round((points / (NAVIGATOR_DOMAINS.length * 2)) * 100)
  const gaps = NAVIGATOR_DOMAINS.flatMap((domain) => {
    const status = input.controls[domain]
    if (status === 'enforced') return []
    return [{ domain, status, priority: status === 'unknown' || status === 'absent' ? 'high' as const : 'medium' as const, action: ACTIONS[domain] }]
  })
  const strengths = NAVIGATOR_DOMAINS.filter((domain) => input.controls[domain] === 'enforced')
  const relevantProtocol = input.protocols.some((protocol) => protocol === 'mcp' || protocol === 'a2a' || protocol === 'x402' || protocol === 'api_tools')
  return {
    schemaVersion: 'maha-navigator/0.1', score,
    band: score >= 75 ? 'controlled' : score >= 40 ? 'developing' : 'foundational',
    gaps, strengths, recommendedPilot: recommendation(input),
    pilotCandidate: relevantProtocol && input.stage !== 'exploring' && gaps.length > 0,
    limits: [
      'This deterministic assessment uses self-reported answers and does not inspect or certify any system.',
      'The score is an inventory-completeness indicator, not a security, legal, privacy, or compliance rating.',
      'Any pilot requires a separate human-approved scope, price, data boundary, and written authorization.',
    ],
  }
}

export function createNavigatorAssessmentId(): string { return `nav_${randomUUID().replaceAll('-', '')}` }
export function navigatorHash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
