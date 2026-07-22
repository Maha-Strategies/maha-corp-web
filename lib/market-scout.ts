// Outbound Scout — READ-ONLY discovery core. Pure functions only: they turn raw
// signals pulled from approved research sources into scored, deduplicated market
// opportunity PROPOSALS for the private market-mapping queue. This module never
// contacts a person, publishes, spends, or deploys anything — it only reads
// signals in and emits proposals out for human review.

import { createHash } from 'node:crypto'

import type { MarketOpportunityInput, MarketSignalClass } from './market-mapping.ts'

export const SCOUT_SOURCE = 'outbound_scout' as const
export const SCOUT_MAX_RESULTS = 25 // hard bound on proposals per run
export const MIN_DIRECT_DEMAND_SCORE = 60

// A raw, read-only signal from an approved source. `retrievedAt` is preserved end
// to end so every proposal carries when its evidence was observed.
export type RawSignal = {
  sourceId: string
  url: string
  title: string
  snippet: string
  query: string
  retrievedAt: string
}

export type ScoutScores = {
  demandEvidence: number
  commercialIntent: number
  capabilityFit: number
  speedToValidate: number
  riskPenalty: number
}

export type ScoutCandidate = {
  sourceReference: string
  title: string
  buyer: string
  problem: string
  proposedSolution: string
  evidence: { url: string; note: string }[]
  signalClass: MarketSignalClass
  scores: ScoutScores
}

// Maha's shippable capabilities the scout maps demand onto. Fit and the proposed
// (human-reviewed) solution are derived deterministically from these.
const CAPABILITIES: { id: string; offer: string; keywords: string[] }[] = [
  { id: 'mps-audit', offer: 'MPS claim-verification API access for evidence-tagged provenance audits', keywords: ['claim verification', 'verify claims', 'fact check', 'fact-check', 'citation audit', 'citation verification', 'source verification', 'provenance', 'hallucination', 'factual accuracy'] },
  { id: 'receipts-to-csv', offer: 'the receipts-to-CSV self-serve micro-utility (no-login, pay-then-run, instant CSV)', keywords: ['receipt', 'expense', 'bookkeep', 'invoice', 'accounting', 'csv', 'reimburs'] },
  { id: 'data-extraction', offer: 'a paid data-extraction micro-utility on the existing pay-then-run rails', keywords: ['extract', 'parse', 'structured data', 'pdf to', 'ocr', 'scan to', 'convert to csv', 'spreadsheet'] },
  { id: 'research-brief', offer: 'a human-scoped verified research brief', keywords: ['research', 'competitive analysis', 'market report', 'intelligence', 'landscape', 'due diligence'] },
]

const DEMAND_TERMS = ['how do i', 'how can i', 'looking for', 'need a', 'need to', 'is there a tool', 'any tool', 'recommend', 'best way to', 'struggling to', 'tired of manually']
const COMMERCIAL_TERMS = ['pay for', 'happy to pay', 'worth paying', 'budget', 'pricing', 'price', 'subscription', 'per month', 'hire', 'quote', 'invoice', 'buy']
const RISK_TERMS = ['medical', 'patient', 'hipaa', 'legal advice', 'attorney', 'lawsuit', 'ssn', 'social security', 'credit card number', 'bypass', 'scrape behind login', 'gambling', 'crypto trading', 'weapon']
const FIRST_PERSON_DEMAND = ['i need', 'we need', 'i am looking', "i'm looking", 'looking for', 'can anyone recommend', 'does anyone know', 'tired of manually', 'need help']
const SEO_TERMS = ['guide', 'methods compared', 'best ', 'review', 'vs.', 'versus', 'pricing plans', 'how to convert', 'top 10', 'alternatives']
const MARKETPLACE_HOSTS = ['upwork.com', 'fiverr.com', 'freelancer.com', 'contra.com', 'peopleperhour.com', 'guru.com']
const COMMUNITY_HOSTS = ['reddit.com', 'news.ycombinator.com', 'stackoverflow.com', 'community.', 'forum.']
// A first-party search query is useful demand evidence only when it contains a
// concrete commercial action and maps to one of the capabilities above. This
// prevents generic informational impressions from becoming sales proposals.
const SEARCH_CONSOLE_INTENT_TERMS = ['api', 'tool', 'service', 'audit', 'pricing', 'price', 'buy', 'hire', 'quote', 'software']

function sanitize(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max)
}

function countHits(haystack: string, terms: string[]): number {
  return terms.reduce((total, term) => (haystack.includes(term) ? total + 1 : total), 0)
}

// Normalize an evidence URL to a canonical HTTPS form; return null for anything
// that is not an absolute HTTPS URL (non-HTTPS sources are dropped, never sent).
export function normalizeHttpsUrl(value: string): string | null {
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:') return null
  url.hash = ''
  const path = url.pathname.replace(/\/+$/, '')
  return `https://${url.host.toLowerCase()}${path}${url.search}`
}

// Stable dedup key for a signal: same discovered URL → same reference across runs,
// so re-runs are idempotent both here and at the queue's unique(source, ref).
export function stableSourceReference(url: string): string {
  const normalized = normalizeHttpsUrl(url) ?? url
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 24)
  const host = (() => { try { return new URL(normalized).host.toLowerCase() } catch { return 'source' } })()
  return sanitize(`outbound-scout:${host}:${digest}`, 200)
}

export function classifySignal(signal: RawSignal): MarketSignalClass {
  const text = `${signal.title} ${signal.snippet} ${signal.query}`.toLowerCase()
  const host = (() => { try { return new URL(signal.url).host.toLowerCase() } catch { return '' } })()
  if (signal.sourceId === 'search_console') {
    return bestCapability(text) && countHits(text, SEARCH_CONSOLE_INTENT_TERMS) >= 2 ? 'buyer_demand' : 'editorial_content'
  }
  if (MARKETPLACE_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))) return 'marketplace_request'
  if (FIRST_PERSON_DEMAND.some((term) => text.includes(term)) && COMMUNITY_HOSTS.some((known) => host.includes(known))) return 'buyer_demand'
  if (SEO_TERMS.some((term) => text.includes(term))) return 'competitor_content'
  return 'editorial_content'
}

// Deterministic component scores derived purely from the signal text.
export function scoutScores(signal: RawSignal): ScoutScores {
  const text = `${signal.title} ${signal.snippet} ${signal.query}`.toLowerCase()
  const demandHits = countHits(text, DEMAND_TERMS)
  const commercialHits = countHits(text, COMMERCIAL_TERMS)
  const hasCurrency = /[$£€]\s?\d/.test(text) || /\busd\b/.test(text)
  const capability = bestCapability(text)
  const riskHits = countHits(text, RISK_TERMS)
  const signalClass = classifySignal(signal)
  const buyerIntent = signalClass === 'marketplace_request' ? 2 : signalClass === 'buyer_demand' ? 1 : 0
  const sourcePenalty = signalClass === 'competitor_content' ? 12 : signalClass === 'editorial_content' ? 6 : 0

  return {
    demandEvidence: buyerIntent === 2 ? 30 : buyerIntent === 1 ? Math.min(26, 14 + demandHits * 4) : Math.min(10, 2 + demandHits * 2),
    commercialIntent: buyerIntent === 2 ? Math.min(25, 16 + commercialHits * 3 + (hasCurrency ? 4 : 0)) : buyerIntent === 1 ? Math.min(20, 8 + commercialHits * 3 + (hasCurrency ? 3 : 0)) : Math.min(5, commercialHits + (hasCurrency ? 2 : 0)),
    capabilityFit: capability ? Math.min(20, 8 + capability.hits * 4) : 4,
    speedToValidate: capability && capability.id !== 'research-brief' ? 13 : 8,
    riskPenalty: Math.min(20, riskHits * 7 + sourcePenalty),
  }
}

function bestCapability(text: string): { id: string; offer: string; hits: number } | null {
  let best: { id: string; offer: string; hits: number } | null = null
  for (const capability of CAPABILITIES) {
    const hits = countHits(text, capability.keywords)
    if (hits > 0 && (!best || hits > best.hits)) best = { id: capability.id, offer: capability.offer, hits }
  }
  return best
}

function inferBuyer(text: string): string {
  if (/freelance|contractor|self-employed|1099/.test(text)) return 'freelancers and independent contractors'
  if (/small business|smb|owner|startup/.test(text)) return 'small-business owners'
  if (/bookkeep|account|cpa/.test(text)) return 'bookkeepers and accountants'
  return 'self-serve professionals'
}

// Build a queue-ready candidate from one signal. Returns null when the signal has
// no usable HTTPS evidence URL. Evidence notes carry the retrieval timestamp.
export function candidateFromSignal(signal: RawSignal): ScoutCandidate | null {
  const normalized = normalizeHttpsUrl(signal.url)
  if (!normalized) return null

  const text = `${signal.title} ${signal.snippet} ${signal.query}`.toLowerCase()
  const capability = bestCapability(text)
  const signalClass = classifySignal(signal)
  const cleanSnippet = sanitize(signal.snippet || signal.title, 800)
  const cleanTitle = sanitize(signal.title || cleanSnippet || 'Discovered market signal', 180)

  const evidenceNote = sanitize(`Retrieved ${signal.retrievedAt} via ${signal.sourceId} query "${signal.query}". ${cleanSnippet}`, 500)
  return {
    sourceReference: stableSourceReference(signal.url),
    title: cleanTitle.length >= 8 ? cleanTitle : `Signal: ${cleanTitle}`.slice(0, 180),
    buyer: inferBuyer(text),
    problem: sanitize(`${signalClass.replaceAll('_', ' ')} signal (${signal.sourceId}/${signal.query}): ${cleanSnippet}`, 1_500),
    proposedSolution: sanitize(
      `Validate demand for ${capability ? capability.offer : 'a self-serve paid micro-utility'} with a landing page and the existing pay-then-run checkout. Read-only proposal for human review — no outreach, spend, or deployment.`,
      1_500,
    ),
    evidence: [{ url: normalized, note: evidenceNote.length >= 3 ? evidenceNote : `Retrieved ${signal.retrievedAt}.` }],
    signalClass,
    scores: scoutScores(signal),
  }
}

// The active queue is for opportunities, not reading material. A result must
// be an explicit buyer request or marketplace request and carry enough demand
// and commercial evidence to justify a human review. Competitor/editorial
// results remain research context and are never active opportunities.
export function qualifiesForActiveDemand(candidate: ScoutCandidate): boolean {
  const score = candidate.scores.demandEvidence + candidate.scores.commercialIntent + candidate.scores.capabilityFit + candidate.scores.speedToValidate - candidate.scores.riskPenalty
  return (candidate.signalClass === 'buyer_demand' || candidate.signalClass === 'marketplace_request')
    && candidate.scores.demandEvidence >= 14
    && candidate.scores.commercialIntent >= 8
    && score >= MIN_DIRECT_DEMAND_SCORE
}

// Deduplicate candidates by sourceReference BEFORE submitting (first wins).
export function dedupeCandidates(candidates: ScoutCandidate[]): ScoutCandidate[] {
  const seen = new Set<string>()
  const unique: ScoutCandidate[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.sourceReference)) continue
    seen.add(candidate.sourceReference)
    unique.push(candidate)
  }
  return unique
}

export function boundCandidates(candidates: ScoutCandidate[], limit: number): ScoutCandidate[] {
  const capped = Math.max(1, Math.min(Math.floor(limit) || SCOUT_MAX_RESULTS, SCOUT_MAX_RESULTS))
  return candidates.slice(0, capped)
}

// Unique per (run, sourceReference); stable if the same run retries the same
// candidate. The queue also dedupes on (source, sourceReference).
export function scoutIdempotencyKey(runId: string, sourceReference: string): string {
  return `scout-${createHash('sha256').update(`${runId}:${sourceReference}`).digest('hex').slice(0, 32)}`
}

// The exact JSON body POSTed to /api/admin/market-opportunities for one candidate.
export function candidateToSubmission(candidate: ScoutCandidate, runId: string): MarketOpportunityInput & { idempotencyKey: string } {
  return {
    source: SCOUT_SOURCE,
    signalClass: candidate.signalClass,
    sourceReference: candidate.sourceReference,
    title: candidate.title,
    buyer: candidate.buyer,
    problem: candidate.problem,
    proposedSolution: candidate.proposedSolution,
    evidence: candidate.evidence,
    demandEvidence: candidate.scores.demandEvidence,
    commercialIntent: candidate.scores.commercialIntent,
    capabilityFit: candidate.scores.capabilityFit,
    speedToValidate: candidate.scores.speedToValidate,
    riskPenalty: candidate.scores.riskPenalty,
    idempotencyKey: scoutIdempotencyKey(runId, candidate.sourceReference),
  }
}
