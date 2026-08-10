import { randomUUID } from 'node:crypto'

export const NAVIGATOR_RUBRIC_KEY = 'maha-internal-icp'
export const NAVIGATOR_RUBRIC_VERSION = 1
export const NAVIGATOR_CLAIM_TYPES = ['account_fit', 'buying_trigger', 'likely_owner', 'disqualifier'] as const
export const NAVIGATOR_SOURCE_QUALITIES = ['primary', 'credible_secondary', 'weak_or_ambiguous'] as const
export const NAVIGATOR_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const
export const NAVIGATOR_EVIDENCE_FRESHNESS = ['current', 'aging', 'stale', 'unknown'] as const
export const NAVIGATOR_DISPOSITIONS = ['unreviewed', 'pursue', 'watch', 'reject', 'insufficient_evidence', 'deferred'] as const

export type NavigatorClaimType = typeof NAVIGATOR_CLAIM_TYPES[number]
export type NavigatorSourceQuality = typeof NAVIGATOR_SOURCE_QUALITIES[number]
export type NavigatorConfidence = typeof NAVIGATOR_CONFIDENCE_LEVELS[number]
export type NavigatorEvidenceFreshness = typeof NAVIGATOR_EVIDENCE_FRESHNESS[number]
export type NavigatorDisposition = typeof NAVIGATOR_DISPOSITIONS[number]

export type NavigatorResearchClaim = {
  publicId: string
  type: NavigatorClaimType
  statement: string
  sourceUrl: string
  sourcePublishedOn: string | null
  observedOn: string
  sourceQuality: NavigatorSourceQuality
  freshness: NavigatorEvidenceFreshness
  confidence: NavigatorConfidence
}

export type NavigatorCandidateInput = {
  idempotencyKey: string
  companyName: string
  companyDomain: string
  rubricKey: typeof NAVIGATOR_RUBRIC_KEY
  rubricVersion: typeof NAVIGATOR_RUBRIC_VERSION
  claims: NavigatorResearchClaim[]
}

export const NAVIGATOR_RUBRIC_V1 = {
  key: NAVIGATOR_RUBRIC_KEY,
  version: NAVIGATOR_RUBRIC_VERSION,
  name: 'Maha internal design-partner research rubric',
  idealAccountProfile: [
    'The account is deploying or piloting agent infrastructure, MCP, A2A, x402, or governed tool use.',
    'The deployment has a concrete governance, payment-safety, context-cost, auditability, or reliability problem Maha can test.',
    'A platform, AI infrastructure, security, engineering, or operations owner can sponsor a bounded assessment.',
  ],
  buyingTriggers: [
    'A public agent, MCP, A2A, wallet, payment, or multi-tool deployment launched or materially changed.',
    'The account published a security, audit, access-control, reliability, or agent-cost requirement.',
    'The account is hiring or assigning ownership for agent platform, AI security, infrastructure, or governance.',
    'A public incident, integration problem, or compliance commitment creates a dated reason to evaluate controls now.',
  ],
  disqualifiers: [
    'No evidence of a real or near-term agent deployment.',
    'No plausible sponsor or bounded workflow to assess.',
    'The evidence is stale, weak, contradictory, or relies on private inference.',
    'The account or person has asked not to be contacted, or contact would violate applicable platform rules or consent boundaries.',
  ],
  qualityGate: {
    reviewedAccounts: 20,
    minimumPursue: 10,
    conversationWorthyDisposition: 'pursue',
    explanation: 'At least 10 of the first 20 reviewed accounts must survive human review as worth a real conversation before Navigator adds message generation or sending.',
  },
} as const

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

function isoDate(value: unknown, name: string, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === '')) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must be an ISO calendar date.`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${name} must be an ISO calendar date.`)
  return value
}

function httpsUrl(value: unknown, name: string): string {
  const parsed = line(value, name, 12, 2_000)
  let url: URL
  try { url = new URL(parsed) } catch { throw new Error(`${name} must be a valid HTTPS URL.`) }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${name} must be a public HTTPS URL without embedded credentials.`)
  return url.toString()
}

export function evidenceFreshness(sourcePublishedOn: string | null, observedOn: string): NavigatorEvidenceFreshness {
  if (!sourcePublishedOn) return 'unknown'
  const ageDays = Math.floor((Date.parse(`${observedOn}T00:00:00Z`) - Date.parse(`${sourcePublishedOn}T00:00:00Z`)) / 86_400_000)
  if (ageDays < 0) throw new Error('sourcePublishedOn cannot be later than observedOn.')
  if (ageDays <= 90) return 'current'
  if (ageDays <= 365) return 'aging'
  return 'stale'
}

export function parseNavigatorCandidate(value: unknown): NavigatorCandidateInput {
  const body = object(value, 'Request body')
  if (!Array.isArray(body.claims) || body.claims.length !== NAVIGATOR_CLAIM_TYPES.length) throw new Error('claims must contain exactly one claim for each required type.')
  const claims = body.claims.map((raw, index): NavigatorResearchClaim => {
    const claim = object(raw, `claims[${index}]`)
    const type = member(claim.type, NAVIGATOR_CLAIM_TYPES, `claims[${index}].type`)
    const observedOn = isoDate(claim.observedOn, `claims[${index}].observedOn`)!
    const sourcePublishedOn = isoDate(claim.sourcePublishedOn, `claims[${index}].sourcePublishedOn`, true)
    return {
      publicId: typeof claim.publicId === 'string' && /^navclm_[a-f0-9]{32}$/.test(claim.publicId) ? claim.publicId : createNavigatorClaimId(),
      type,
      statement: text(claim.statement, `claims[${index}].statement`, 10, 1_500),
      sourceUrl: httpsUrl(claim.sourceUrl, `claims[${index}].sourceUrl`),
      sourcePublishedOn,
      observedOn,
      sourceQuality: member(claim.sourceQuality, NAVIGATOR_SOURCE_QUALITIES, `claims[${index}].sourceQuality`),
      freshness: evidenceFreshness(sourcePublishedOn, observedOn),
      confidence: member(claim.confidence, NAVIGATOR_CONFIDENCE_LEVELS, `claims[${index}].confidence`),
    }
  })
  if (new Set(claims.map((claim) => claim.type)).size !== NAVIGATOR_CLAIM_TYPES.length) throw new Error('claims must contain exactly one claim for each required type.')
  for (const type of NAVIGATOR_CLAIM_TYPES) if (!claims.some((claim) => claim.type === type)) throw new Error(`claims must include ${type}.`)
  const rubricKey = body.rubricKey ?? NAVIGATOR_RUBRIC_KEY
  const rubricVersion = body.rubricVersion ?? NAVIGATOR_RUBRIC_VERSION
  if (rubricKey !== NAVIGATOR_RUBRIC_KEY || rubricVersion !== NAVIGATOR_RUBRIC_VERSION) throw new Error('The requested Navigator rubric is not supported.')
  const domain = line(body.companyDomain, 'companyDomain', 3, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new Error('companyDomain must be a valid domain name.')
  return {
    idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120),
    companyName: line(body.companyName, 'companyName', 2, 160),
    companyDomain: domain,
    rubricKey,
    rubricVersion,
    claims,
  }
}

export type NavigatorQualityGateRow = { benchmarkPosition: number | null; disposition: NavigatorDisposition }

export function buildNavigatorQualityGate(rows: NavigatorQualityGateRow[]) {
  const cohort = rows.filter((row) => row.benchmarkPosition !== null && row.benchmarkPosition >= 1 && row.benchmarkPosition <= 20)
    .sort((left, right) => left.benchmarkPosition! - right.benchmarkPosition!)
  const reviewed = cohort.length
  const pursue = cohort.filter((row) => row.disposition === 'pursue').length
  const counts = Object.fromEntries(NAVIGATOR_DISPOSITIONS.map((disposition) => [disposition, cohort.filter((row) => row.disposition === disposition).length])) as Record<NavigatorDisposition, number>
  return {
    state: reviewed < 20 ? 'collecting' as const : pursue >= 10 ? 'passed' as const : 'failed' as const,
    reviewed,
    requiredReviewed: 20,
    pursue,
    requiredPursue: 10,
    remaining: Math.max(0, 20 - reviewed),
    conversationWorthyRate: reviewed === 0 ? null : pursue / reviewed,
    counts,
    qualityGatePassed: reviewed === 20 && pursue >= 10,
    outreachAuthorized: false as const,
    interpretation: reviewed < 20
      ? 'The benchmark is incomplete. Do not infer quality or add outreach automation.'
      : pursue >= 10
        ? 'The research rubric passed its first quality gate. This does not authorize contact or autonomous sending.'
        : 'The rubric did not produce enough conversation-worthy accounts. Revise the rubric before adding automation.',
  }
}

export function createNavigatorCandidateId(): string { return `navacct_${randomUUID().replaceAll('-', '')}` }
export function createNavigatorClaimId(): string { return `navclm_${randomUUID().replaceAll('-', '')}` }
