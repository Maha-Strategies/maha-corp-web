import { createHash } from 'node:crypto'

export const MPS_VERSION = '0.1'
export const MAX_AUDIT_CHARS = 6_000

export const MPS_TAGS = ['VERIFIED', 'SOURCED', 'BOUNDARY', 'ILLUSTRATIVE', 'UNVERIFIED'] as const
export const MPS_ACTIONS = ['none', 'verify', 'cite', 'reword', 'remove'] as const

export type MpsTag = typeof MPS_TAGS[number]
export type MpsAction = typeof MPS_ACTIONS[number]

export type MpsAuditClaim = {
  excerpt: string
  tag: MpsTag
  rationale: string
  action: MpsAction
}

export type MpsAuditResult = {
  mps_version: typeof MPS_VERSION
  input_hash: string
  claims: MpsAuditClaim[]
}

export type MpsAuditRunner = (prompt: string) => Promise<string>

export class MpsAuditError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MpsAuditError'
    this.status = status
  }
}

const TAG_SET = new Set<string>(MPS_TAGS)
const ACTION_SET = new Set<string>(MPS_ACTIONS)

export function validateAuditPassage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MpsAuditError('No passage provided.', 400)
  }
  const passage = value.trim()
  if (passage.length > MAX_AUDIT_CHARS) {
    throw new MpsAuditError(`Passage too long for the demo (max ~${MAX_AUDIT_CHARS} characters).`, 413)
  }
  return passage
}

export function auditInputHash(passage: string): string {
  return `sha256:${createHash('sha256').update(passage).digest('hex')}`
}

export function buildMpsAuditPrompt(passage: string): string {
  return `You are an auditor applying the Maha Provenance Standard v0.1 to a nonfiction passage. Tag every SUBSTANTIVE claim (fact, attribution, quantity, causation, consensus). Skip pure opinion and rhetoric.

Tags:
VERIFIED - author could only claim this after checking a primary source or reproducing it. Use rarely; an auditor can seldom confirm this from text alone, so prefer SOURCED or UNVERIFIED.
SOURCED - attributed to an identifiable, citable source, or standard well-documented history/science a reader could cite (name the likely source type in rationale).
BOUNDARY - the claim's content is honest uncertainty: open questions, untested conjecture, stated limits of knowledge.
ILLUSTRATIVE - analogy, metaphor, thought experiment, composite example.
UNVERIFIED - specific numbers, quotes, studies, or findings with no identifiable source; anything that must be checked before publication. Statistics without citations are ALWAYS UNVERIFIED.

Rules: quotations and statistics are never ILLUSTRATIVE. "Studies show" without a named study is UNVERIFIED. First-person references to the author's own prior work are UNVERIFIED from an auditor's seat (cannot confirm).

Respond with ONLY valid JSON, no markdown fences, no preamble:
{"claims":[{"excerpt":"verbatim substring copied EXACTLY from the passage, 6-25 words","tag":"VERIFIED|SOURCED|BOUNDARY|ILLUSTRATIVE|UNVERIFIED","rationale":"one sentence","action":"none|verify|cite|reword|remove"}]}

Excerpts must be exact verbatim substrings of the passage. Passage:

${passage}`
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function normalizeClaim(value: unknown, passage: string): MpsAuditClaim | null {
  const claim = object(value)
  if (!claim || typeof claim.excerpt !== 'string' || typeof claim.tag !== 'string' || typeof claim.rationale !== 'string') return null

  const excerpt = claim.excerpt.trim()
  const rationale = claim.rationale.trim()
  if (!TAG_SET.has(claim.tag) || !passage.includes(excerpt) || wordCount(excerpt) < 6 || wordCount(excerpt) > 25 || !rationale || rationale.length > 1_000) {
    return null
  }

  return {
    excerpt,
    tag: claim.tag as MpsTag,
    rationale,
    action: typeof claim.action === 'string' && ACTION_SET.has(claim.action) ? claim.action as MpsAction : 'none',
  }
}

export function parseMpsAuditResponse(raw: string, passage: string): MpsAuditClaim[] {
  const clean = raw.replace(/```json|```/g, '').trim()
  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace < firstBrace) throw new MpsAuditError('The audit model did not return a JSON object.', 502)

  let parsed: Record<string, unknown>
  try {
    const value = JSON.parse(clean.slice(firstBrace, lastBrace + 1)) as unknown
    parsed = object(value) ?? {}
  } catch {
    throw new MpsAuditError('The audit model returned invalid JSON.', 502)
  }

  const rawClaims = Array.isArray(parsed.claims) ? parsed.claims : []
  const seen = new Set<string>()
  const claims = rawClaims.flatMap((claim) => {
    const normalized = normalizeClaim(claim, passage)
    if (!normalized || seen.has(normalized.excerpt)) return []
    seen.add(normalized.excerpt)
    return [normalized]
  })

  if (!claims.length) {
    throw new MpsAuditError('No valid substantive claims were identified. Try a longer passage.', 422)
  }
  return claims
}

export async function runMpsAudit(value: unknown, runner: MpsAuditRunner): Promise<MpsAuditResult> {
  const passage = validateAuditPassage(value)
  const raw = await runner(buildMpsAuditPrompt(passage))
  return {
    mps_version: MPS_VERSION,
    input_hash: auditInputHash(passage),
    claims: parseMpsAuditResponse(raw, passage),
  }
}
