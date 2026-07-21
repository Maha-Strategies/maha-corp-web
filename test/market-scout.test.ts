import assert from 'node:assert/strict'
import test from 'node:test'

import { marketOpportunityScore, parseMarketOpportunity } from '../lib/market-mapping.ts'
import {
  SCOUT_SOURCE, type RawSignal, boundCandidates, candidateFromSignal, candidateToSubmission,
  classifySignal, dedupeCandidates, normalizeHttpsUrl, scoutIdempotencyKey, scoutScores, stableSourceReference,
} from '../lib/market-scout.ts'
import { ScoutConfigError, configuredScoutSources, type ResearchSource } from '../lib/market-scout-sources.ts'
import { httpQueueSubmitter, runMarketScout, type ScoutSubmitter } from '../lib/market-scout-runner.ts'

function signal(over: Partial<RawSignal> = {}): RawSignal {
  return {
    sourceId: 'exa', url: 'https://forum.example.com/thread/123', query: 'how do I convert receipts to a spreadsheet',
    title: 'Need a tool to convert receipts to CSV',
    snippet: 'I am a freelancer tired of manually typing receipts into a spreadsheet. Happy to pay for a tool. Budget around $20.',
    retrievedAt: '2026-07-21T10:00:00.000Z', ...over,
  }
}

function withEnv(env: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const keys = ['MARKET_MAPPING_TOKEN', 'MARKET_SCOUT_SOURCES', 'MARKET_SCOUT_QUERIES', 'EXA_API_KEY']
  const prior = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  for (const k of keys) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
  return (async () => { try { await run() } finally { for (const k of keys) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k] } } })()
}

// ---- Deterministic scoring ----
test('scoutScores is deterministic and every component stays within its bound', () => {
  const s1 = scoutScores(signal())
  const s2 = scoutScores(signal())
  assert.deepEqual(s1, s2) // deterministic
  assert.ok(s1.demandEvidence >= 0 && s1.demandEvidence <= 30)
  assert.ok(s1.commercialIntent >= 0 && s1.commercialIntent <= 25)
  assert.ok(s1.capabilityFit >= 0 && s1.capabilityFit <= 20)
  assert.ok(s1.speedToValidate >= 0 && s1.speedToValidate <= 15)
  assert.ok(s1.riskPenalty >= 0 && s1.riskPenalty <= 20)
  // A commercial, on-capability signal scores commercial intent and fit above zero.
  assert.ok(s1.commercialIntent > 0)
  assert.ok(s1.capabilityFit > 4)
  // A risky, off-topic signal is penalized and unfit.
  const risky = scoutScores(signal({ title: 'medical patient records hipaa', snippet: 'attorney legal advice lawsuit', query: 'legal advice' }))
  assert.ok(risky.riskPenalty > 0)
  assert.equal(risky.capabilityFit, 4)
})

test('signal class distinguishes direct demand from marketplace, competitor SEO, and editorial context', () => {
  assert.equal(classifySignal(signal()), 'buyer_demand')
  assert.equal(classifySignal(signal({ url: 'https://www.upwork.com/jobs/receipt-extraction', title: 'Need receipt extraction developer' })), 'marketplace_request')
  const competitor = signal({ url: 'https://vendor.example.com/blog/receipt-guide', title: 'Convert receipts to spreadsheets: 5 methods compared', snippet: 'Our guide compares the best tools and pricing plans.' })
  assert.equal(classifySignal(competitor), 'competitor_content')
  assert.ok(scoutScores(competitor).riskPenalty >= 12)
  assert.ok(scoutScores(competitor).commercialIntent <= 5)
  assert.equal(classifySignal(signal({ url: 'https://news.example.com/report', title: 'Quarterly report', snippet: 'A market overview.' })), 'editorial_content')
})

// ---- Candidate mapping + HTTPS/evidence/timestamps ----
test('candidateFromSignal drops non-HTTPS and preserves URL + retrieval timestamp', () => {
  assert.equal(candidateFromSignal(signal({ url: 'http://insecure.example.com/x' })), null)
  assert.equal(candidateFromSignal(signal({ url: 'not a url' })), null)

  const candidate = candidateFromSignal(signal())
  assert.ok(candidate)
  assert.equal(candidate!.evidence.length, 1)
  assert.ok(candidate!.evidence[0].url.startsWith('https://'))
  assert.match(candidate!.evidence[0].note, /2026-07-21T10:00:00\.000Z/) // retrieval timestamp preserved
  assert.ok(candidate!.problem.length >= 20 && candidate!.proposedSolution.length >= 20 && candidate!.title.length >= 8)
  assert.match(candidate!.sourceReference, /^outbound-scout:/)
  assert.equal(candidate!.signalClass, 'buyer_demand')
})

test('candidateToSubmission passes the queue validator with a consistent score', () => {
  const candidate = candidateFromSignal(signal())!
  const body = candidateToSubmission(candidate, 'run-1')
  const parsed = parseMarketOpportunity(body) // throws if invalid — evidence https, field bounds, source allowed
  assert.equal(parsed.source, SCOUT_SOURCE)
  assert.equal(marketOpportunityScore(body), body.demandEvidence + body.commercialIntent + body.capabilityFit + body.speedToValidate - body.riskPenalty)
  assert.ok(body.idempotencyKey.length >= 8)
})

// ---- Stable dedup + idempotency ----
test('stableSourceReference ignores trailing slash and fragment; differs by URL', () => {
  const a = stableSourceReference('https://x.example.com/thread/1')
  const b = stableSourceReference('https://x.example.com/thread/1/#reply')
  const c = stableSourceReference('https://x.example.com/thread/2')
  assert.equal(a, b) // same opportunity → same reference across runs
  assert.notEqual(a, c)
  assert.equal(normalizeHttpsUrl('http://x.example.com'), null)
})

test('dedupeCandidates collapses duplicate sourceReferences (before submit)', () => {
  const one = candidateFromSignal(signal({ url: 'https://x.example.com/a' }))!
  const dup = candidateFromSignal(signal({ url: 'https://x.example.com/a/', query: 'different query' }))!
  const two = candidateFromSignal(signal({ url: 'https://x.example.com/b' }))!
  assert.equal(dedupeCandidates([one, dup, two]).length, 2)
})

test('scoutIdempotencyKey is stable per (run, reference) and unique across references', () => {
  const key = scoutIdempotencyKey('run-1', 'ref-a')
  assert.equal(key, scoutIdempotencyKey('run-1', 'ref-a')) // stable on retry
  assert.notEqual(key, scoutIdempotencyKey('run-1', 'ref-b')) // unique per reference
  assert.notEqual(key, scoutIdempotencyKey('run-2', 'ref-a')) // unique per run
  assert.ok(key.length >= 8)
})

test('boundCandidates enforces the hard batch cap', () => {
  const many = Array.from({ length: 40 }, (_, i) => candidateFromSignal(signal({ url: `https://x.example.com/${i}` }))!)
  assert.equal(boundCandidates(many, 3).length, 3)
  assert.equal(boundCandidates(many, 999).length, 25) // SCOUT_MAX_RESULTS
})

// ---- Runner: dedupe, bound, submit-only, counts ----
test('runMarketScout dedupes, submits only proposals, and reports created/duplicate/failed', async () => {
  await withEnv({ MARKET_MAPPING_TOKEN: 'tok' }, async () => {
    const source: ResearchSource = { id: 'stub', search: async () => [
      signal({ url: 'https://x.example.com/a' }),
      signal({ url: 'https://x.example.com/a', query: 'dup url different query' }), // dedupes with the first
      signal({ url: 'https://x.example.com/b' }),
      signal({ url: 'http://x.example.com/c' }), // non-HTTPS → dropped
    ] }

    const submitted: (Record<string, unknown>)[] = []
    const submit: ScoutSubmitter = async (body) => {
      submitted.push(body)
      if (body.sourceReference === stableSourceReference('https://x.example.com/b')) return { ok: true, status: 201, idempotentReplay: true }
      return { ok: true, status: 201, idempotentReplay: false }
    }

    const summary = await runMarketScout({ fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as never, submit, sources: [source], runId: 'run-1' })
    assert.equal(summary.discovered, 4)
    assert.equal(summary.unique, 2) // a (with dup collapsed) + b; c dropped
    assert.equal(summary.submitted, 1)
    assert.equal(summary.duplicates, 1)
    assert.equal(summary.failed, 0)

    // Submit is the ONLY sink, and every payload is a market-opportunity proposal —
    // no recipient/message/spend fields exist on it.
    assert.equal(submitted.length, 2)
    for (const body of submitted) {
      assert.equal(body.source, SCOUT_SOURCE)
      assert.ok(typeof body.signalClass === 'string' && ['buyer_demand', 'competitor_content', 'marketplace_request', 'editorial_content'].includes(body.signalClass))
      assert.ok(Array.isArray(body.evidence))
      for (const key of ['to', 'email', 'recipient', 'message', 'amount', 'publish']) assert.ok(!(key in body), `payload must not contain ${key}`)
    }
  })
})

test('runMarketScout respects the limit', async () => {
  await withEnv({ MARKET_MAPPING_TOKEN: 'tok' }, async () => {
    const source: ResearchSource = { id: 'stub', search: async () => Array.from({ length: 10 }, (_, i) => signal({ url: `https://x.example.com/${i}` })) }
    const submit: ScoutSubmitter = async () => ({ ok: true, status: 201, idempotentReplay: false })
    const summary = await runMarketScout({ fetchImpl: (() => { throw new Error('unused') }) as never, submit, sources: [source], limit: 2, runId: 'r' })
    assert.equal(summary.unique, 2)
    assert.equal(summary.submitted, 2)
  })
})

// ---- Fail closed ----
test('runMarketScout fails closed without MARKET_MAPPING_TOKEN', async () => {
  await withEnv({ MARKET_MAPPING_TOKEN: undefined }, async () => {
    await assert.rejects(
      runMarketScout({ fetchImpl: (() => { throw new Error('x') }) as never, submit: async () => ({ ok: true, status: 201, idempotentReplay: false }), sources: [{ id: 's', search: async () => [] }] }),
      ScoutConfigError,
    )
  })
})

test('configuredScoutSources fails closed on missing list, missing credential, or unknown source', async () => {
  await withEnv({ MARKET_SCOUT_SOURCES: undefined }, () => assert.throws(() => configuredScoutSources(), ScoutConfigError))
  await withEnv({ MARKET_SCOUT_SOURCES: 'exa', EXA_API_KEY: undefined }, () => assert.throws(() => configuredScoutSources(), /EXA_API_KEY is required/))
  await withEnv({ MARKET_SCOUT_SOURCES: 'mystery', EXA_API_KEY: 'k' }, () => assert.throws(() => configuredScoutSources(), /Unknown research source/))
  await withEnv({ MARKET_SCOUT_SOURCES: 'exa', EXA_API_KEY: 'k' }, () => assert.deepEqual(configuredScoutSources().map((s) => s.id), ['exa']))
})

// ---- Exa source is read-only search (no writes) ----
test('exa source issues a read-only highlights search and maps results, preserving URLs', async () => {
  await withEnv({ MARKET_SCOUT_SOURCES: 'exa', EXA_API_KEY: 'k', MARKET_SCOUT_QUERIES: JSON.stringify(['one query']) }, async () => {
    const calls: { url: string; method?: string; body?: string }[] = []
    const fetchImpl = async (url: string, init?: { method?: string; body?: string }) => {
      calls.push({ url, method: init?.method, body: init?.body })
      return { ok: true, status: 200, json: async () => ({ results: [{ url: 'https://r.example.com/1', title: 'T', highlights: ['evidence excerpt'] }] }) }
    }
    const [source] = configuredScoutSources()
    const signals = await source.search(fetchImpl)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.exa.ai/search') // only ever the search endpoint
    assert.equal(JSON.parse(calls[0].body!).contents.highlights, true)
    assert.equal(signals.length, 1)
    assert.equal(signals[0].url, 'https://r.example.com/1')
    assert.equal(signals[0].snippet, 'evidence excerpt')
    assert.ok(signals[0].retrievedAt) // timestamp stamped at retrieval
  })
})

test('httpQueueSubmitter posts to the market-mapping queue with the bearer token', async () => {
  const original = globalThis.fetch
  const seen: { url: string; auth?: string; body?: string }[] = []
  globalThis.fetch = (async (url: string, init: { headers?: Record<string, string>; body?: string }) => {
    seen.push({ url, auth: init.headers?.Authorization, body: init.body })
    return { ok: true, status: 201, json: async () => ({ opportunity: { idempotentReplay: false } }) }
  }) as unknown as typeof fetch
  try {
    const submit = httpQueueSubmitter('https://app.example.com', 'secret-token')
    const result = await submit(candidateToSubmission(candidateFromSignal(signal())!, 'run-1'))
    assert.equal(result.ok, true)
    assert.equal(seen[0].url, 'https://app.example.com/api/admin/market-opportunities')
    assert.equal(seen[0].auth, 'Bearer secret-token')
  } finally { globalThis.fetch = original }
})
