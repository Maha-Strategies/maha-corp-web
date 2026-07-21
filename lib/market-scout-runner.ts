// Outbound Scout orchestration. Reads signals from approved sources, maps them to
// scored proposals, deduplicates, bounds the batch, and SUBMITS ONLY to the
// private market-mapping queue. It fails closed if MARKET_MAPPING_TOKEN or an
// approved source's credential is missing. It has exactly two side effects:
// read-only source queries (injected fetch) and POSTs to the queue (injected
// submit). It cannot email, DM, publish, run ads, spend, deploy, or accept work.

import { randomUUID } from 'node:crypto'

import { type MarketOpportunityInput, marketOpportunityScore, parseMarketOpportunity } from './market-mapping.ts'
import {
  type RawSignal, boundCandidates, candidateFromSignal, candidateToSubmission, dedupeCandidates,
} from './market-scout.ts'
import { type FetchLike, type ResearchSource, ScoutConfigError, configuredScoutSources } from './market-scout-sources.ts'

export type ScoutSubmitResult = { ok: boolean; status: number; idempotentReplay: boolean }
export type ScoutSubmitter = (body: MarketOpportunityInput & { idempotencyKey: string }) => Promise<ScoutSubmitResult>

export type ScoutRunSummary = {
  runId: string
  sources: string[]
  discovered: number
  candidates: number
  unique: number
  submitted: number
  duplicates: number
  failed: number
  results: { sourceReference: string; score: number; outcome: 'created' | 'duplicate' | 'failed' }[]
}

export async function runMarketScout(options: {
  fetchImpl: FetchLike
  submit: ScoutSubmitter
  sources?: ResearchSource[]
  limit?: number
  runId?: string
}): Promise<ScoutRunSummary> {
  // Fail closed: without the queue token, no proposal can be submitted.
  if (!process.env.MARKET_MAPPING_TOKEN) throw new ScoutConfigError('MARKET_MAPPING_TOKEN is required to submit proposals.')

  const sources = options.sources ?? configuredScoutSources() // throws (fail closed) on missing credential
  const runId = options.runId ?? randomUUID()

  // 1. Read-only pull from every approved source.
  const signals: RawSignal[] = []
  for (const source of sources) {
    try { signals.push(...await source.search(options.fetchImpl)) }
    catch { console.error(`Research source "${source.id}" failed; skipping it.`) }
  }

  // 2. Map to candidates, dropping anything that fails the queue's own validator.
  const candidates = signals
    .map((signal) => candidateFromSignal(signal))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .filter((candidate) => {
      try {
        const body = candidateToSubmission(candidate, runId)
        parseMarketOpportunity(body)
        return marketOpportunityScore(body) >= -20 && marketOpportunityScore(body) <= 90
      } catch { return false }
    })

  // 3. Deduplicate BEFORE submitting, then bound the batch.
  const unique = boundCandidates(dedupeCandidates(candidates), options.limit ?? Number.NaN)

  // 4. Submit proposals to the private queue only.
  const results: ScoutRunSummary['results'] = []
  let submitted = 0, duplicates = 0, failed = 0
  for (const candidate of unique) {
    const body = candidateToSubmission(candidate, runId)
    const score = marketOpportunityScore(body)
    try {
      const result = await options.submit(body)
      if (!result.ok) { failed += 1; results.push({ sourceReference: candidate.sourceReference, score, outcome: 'failed' }); continue }
      if (result.idempotentReplay) { duplicates += 1; results.push({ sourceReference: candidate.sourceReference, score, outcome: 'duplicate' }) }
      else { submitted += 1; results.push({ sourceReference: candidate.sourceReference, score, outcome: 'created' }) }
    } catch {
      failed += 1
      results.push({ sourceReference: candidate.sourceReference, score, outcome: 'failed' })
    }
  }

  return { runId, sources: sources.map((s) => s.id), discovered: signals.length, candidates: candidates.length, unique: unique.length, submitted, duplicates, failed, results }
}

// Real submitter: POST to the private market-mapping queue with the bearer token.
// This is the ONLY outbound write the scout performs.
export function httpQueueSubmitter(origin: string, token: string): ScoutSubmitter {
  return async (body) => {
    const response = await fetch(`${origin}/api/admin/market-opportunities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    let idempotentReplay = false
    try {
      const json = await response.json() as { opportunity?: { idempotentReplay?: unknown } }
      idempotentReplay = json.opportunity?.idempotentReplay === true
    } catch { /* non-JSON error body */ }
    return { ok: response.ok, status: response.status, idempotentReplay }
  }
}

// Adapts global fetch to the injectable FetchLike shape used by sources.
export const globalFetchImpl: FetchLike = (url, init) => fetch(url, init as RequestInit)
