import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createEvidencePreflightHandlers } from '../lib/evidence-preflight-api.ts'
import { compileEvidencePreflight, parseEvidencePreflightInput, verifyEvidencePreflightResult } from '../lib/evidence-preflight.ts'
import type { EvidencePreflightInput } from '../lib/evidence-preflight-contract.ts'

const SHA_A = `sha256:${'a'.repeat(64)}`
const SHA_B = `sha256:${'b'.repeat(64)}`
const SHA_C = `sha256:${'c'.repeat(64)}`

function validInput(overrides: Partial<EvidencePreflightInput> = {}): EvidencePreflightInput {
  return {
    requestId: 'epf_11111111-1111-4111-8111-111111111111',
    submissionConfirmedNonConfidential: true,
    claims: [{
      claim: 'The measured transition occurred under the reported test conditions.',
      source: { kind: 'doi', identifier: 'https://doi.org/10.1234/EXAMPLE.2026.1', title: 'Example measurement' },
      excerpt: 'Under the reported test conditions, the measured transition occurred after the controlled input changed.',
      locator: { kind: 'section', value: 'Results, paragraph 2' },
      rights: { basis: 'limited-quotation-review', accessStatus: 'open' },
    }],
    ...overrides,
  }
}

test('a bounded located excerpt produces a deterministic digest without claiming verification', () => {
  const parsed = parseEvidencePreflightInput(validInput())
  const first = compileEvidencePreflight(parsed)
  const second = compileEvidencePreflight(parsed)
  assert.deepEqual(first, second)
  assert.match(first.resultSha256, /^sha256:[a-f0-9]{64}$/)
  assert.equal(first.independentSourceInspectionPerformed, false)
  assert.equal(first.contentRetainedByMaha, false)
  assert.equal(first.assessments[0].evidenceStatus, 'user-supplied-located-excerpt')
  assert.equal(first.assessments[0].source.identityStatus, 'declared-format-valid')
  assert.ok(!(['verified', 'primary-source'] as string[]).includes(first.assessments[0].evidenceStatus))
  assert.deepEqual(verifyEvidencePreflightResult(first), [])
})

test('DOIs normalize deterministically and public URLs reject local or credential-bearing targets', () => {
  const doi = compileEvidencePreflight(parseEvidencePreflightInput(validInput()))
  assert.equal(doi.assessments[0].source.normalizedIdentifier, '10.1234/example.2026.1')
  const local = validInput({ claims: [{ ...validInput().claims[0], source: { kind: 'url', identifier: 'https://127.0.0.1/private' } }] })
  const localResult = compileEvidencePreflight(parseEvidencePreflightInput(local))
  assert.equal(localResult.assessments[0].source.identityStatus, 'declared-format-invalid')
  assert.ok(localResult.assessments[0].blockers.includes('source-identifier-invalid'))
})

test('metadata-only, missing locators, rights gaps, and restricted access fail closed', () => {
  const result = compileEvidencePreflight(parseEvidencePreflightInput(validInput({ claims: [{
    claim: 'A bounded claim awaiting source inspection.', source: { kind: 'doi', identifier: '10.1234/example' },
    rights: { basis: 'open-license', accessStatus: 'restricted' },
  }] })))
  const assessment = result.assessments[0]
  assert.equal(assessment.evidenceStatus, 'metadata-only')
  assert.equal(assessment.readiness, 'blocked-before-source-inspection')
  assert.deepEqual(assessment.blockers, [
    'exact-locator-missing', 'open-license-not-identified', 'source-access-restricted', 'source-metadata-only',
  ])
})

test('absolute and unsupported causal language is flagged without pretending to decide truth', () => {
  const result = compileEvidencePreflight(parseEvidencePreflightInput(validInput({ claims: [{
    ...validInput().claims[0],
    claim: 'This treatment always causes a safe outcome for every patient.',
    excerpt: 'The study observed an outcome in a limited experimental cohort.',
  }] })))
  const assessment = result.assessments[0]
  assert.equal(assessment.scopeAssessment.status, 'overbroad-language')
  assert.equal(assessment.unsupportedInferenceAssessment.status, 'lexical-risk-detected')
  assert.ok(assessment.blockers.includes('claim-scope-overbroad'))
  assert.ok(assessment.blockers.includes('unsupported-inference-risk'))
  assert.match(assessment.lexicalCoverage.boundary, /does not establish semantic entailment/)
})

test('tampering with any assessed field invalidates the result digest', () => {
  const result = compileEvidencePreflight(parseEvidencePreflightInput(validInput()))
  const tampered = structuredClone(result)
  tampered.assessments[0].claim = 'A substituted claim.'
  assert.deepEqual(verifyEvidencePreflightResult(tampered), ['result-digest-mismatch'])
})

test('the parser limits the tool to three claims and requires a non-confidential submission declaration', () => {
  assert.throws(() => parseEvidencePreflightInput({ ...validInput(), claims: Array.from({ length: 4 }, () => validInput().claims[0]) }), /1-3 entries/)
  assert.throws(() => parseEvidencePreflightInput({ ...validInput(), submissionConfirmedNonConfidential: false }), /no confidential/)
  assert.throws(() => parseEvidencePreflightInput({ ...validInput(), requestId: 'reused' }), /requestId is invalid/)
  assert.throws(() => parseEvidencePreflightInput({ ...validInput(), unexpected: true }), /unsupported fields/)
  assert.throws(() => parseEvidencePreflightInput({ ...validInput(), claims: [{ ...validInput().claims[0], source: { ...validInput().claims[0].source, publicationDate: '2026-02-31' } }] }), /ISO date/)
})

class MemoryLedger {
  readonly calls: Record<string, unknown>[] = []
  readonly requests = new Map<string, string>()
  forced: string | null = null

  async rpc(name: string, args: Record<string, unknown>) {
    assert.equal(name, 'record_evidence_preflight_request')
    this.calls.push(structuredClone(args))
    if (this.forced) return { data: this.forced, error: null }
    const requestHash = String(args.p_request_hash)
    const payloadHmac = String(args.p_payload_hmac)
    const existing = this.requests.get(requestHash)
    if (existing && existing !== payloadHmac) return { data: 'conflict', error: null }
    if (existing) return { data: 'idempotent', error: null }
    this.requests.set(requestHash, payloadHmac)
    return { data: 'created', error: null }
  }
}

function request(input = validInput(), origin = 'https://www.mahastrategies.com') {
  return new Request('https://www.mahastrategies.com/api/evidence-preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Host: 'www.mahastrategies.com' },
    body: JSON.stringify(input),
  })
}

function handlers(ledger: MemoryLedger | null) {
  return createEvidencePreflightHandlers({
    ledger: () => ledger,
    visitorHash: () => SHA_A,
    requestHash: (_visitorHash, requestId) => requestId.includes('1111') ? SHA_B : SHA_C,
    payloadHmac: (_visitorHash, input) => input.claims[0].claim.includes('substituted') ? SHA_C : SHA_B,
  })
}

test('the public route is same-origin, rate-limited, replay-safe, and returns the same result on replay', async () => {
  const ledger = new MemoryLedger()
  const route = handlers(ledger)
  const first = await route.post(request())
  assert.equal(first.status, 201)
  const firstBody = await first.json()
  assert.equal(firstBody.status, 'created')
  const replay = await route.post(request())
  assert.equal(replay.status, 200)
  const replayBody = await replay.json()
  assert.equal(replayBody.status, 'idempotent')
  assert.deepEqual(replayBody.result, firstBody.result)
  assert.equal((await route.post(request(validInput(), 'https://attacker.example'))).status, 403)
  ledger.forced = 'rate_limited'
  const limited = await route.post(request({ ...validInput(), requestId: 'epf_22222222-2222-4222-8222-222222222222' }))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('Retry-After'), '86400')
})

test('request-ID substitution is refused and the durable ledger receives metadata only', async () => {
  const ledger = new MemoryLedger()
  const route = handlers(ledger)
  assert.equal((await route.post(request())).status, 201)
  const changed = validInput({ claims: [{ ...validInput().claims[0], claim: 'A substituted claim with the same request identifier.' }] })
  const conflict = await route.post(request(changed))
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).error.code, 'idempotency_conflict')
  const persistedShape = JSON.stringify(ledger.calls)
  assert.doesNotMatch(persistedShape, /measured transition|substituted claim|10\.1234|Results, paragraph|Example measurement/)
  assert.match(persistedShape, /p_payload_hmac/)
  assert.match(persistedShape, /p_claim_count/)
})

test('the route fails closed when the privacy ledger is unavailable', async () => {
  const response = await handlers(null).post(request())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error.code, 'preflight_unavailable')
})

test('the migration stores no content fields and enforces atomic replay and rate limiting', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260830190000_public_evidence_preflight.sql', import.meta.url), 'utf8')
  const table = sql.slice(sql.indexOf('create table'), sql.indexOf('create index'))
  assert.doesNotMatch(table, /\b(?:claim|excerpt|identifier|title|locator|request_body|ip_address|user_agent)\b/i)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /return 'idempotent'/)
  assert.match(sql, /return 'conflict'/)
  assert.match(sql, /return 'rate_limited'/)
  assert.match(sql, /revoke all on table public\.evidence_preflight_request_ledger from public, anon, authenticated/)
  assert.match(sql, /grant execute .* to service_role/)
})

test('the page is crawlable, internally linked, offer-disabled, and machine-indexed', async () => {
  const [page, tools, audit, sitemap, llms] = await Promise.all([
    readFile(new URL('../app/tools/evidence-preflight/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/tools/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/evidence-audit/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8'),
  ])
  assert.match(page, /alternates: \{ canonical: PATH \}/)
  assert.match(page, /application\/ld\+json/)
  assert.match(page, /purchase disabled/i)
  assert.match(page, /Purchase unavailable/)
  assert.match(page, /disabled aria-disabled="true"/)
  assert.match(tools, /\/tools\/evidence-preflight/)
  assert.match(audit, /\/tools\/evidence-preflight/)
  assert.match(sitemap, /\/tools\/evidence-preflight/)
  assert.match(llms, /Deterministic public Evidence Preflight/)
})

test('the client boundary imports no private corpus, credentials, database client, or server evaluator', async () => {
  const form = await readFile(new URL('../app/tools/evidence-preflight/EvidencePreflightForm.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(form, /epistemic|frontier|source-override|review-decision|canonical-release|SUPABASE|ANTHROPIC|OPENAI|server-only/i)
  assert.doesNotMatch(form, /from ['"]@\/lib\/evidence-preflight['"]/)
  assert.doesNotMatch(form, /localStorage|sessionStorage|indexedDB/)
  assert.match(form, /credentials: 'omit'/)
})
