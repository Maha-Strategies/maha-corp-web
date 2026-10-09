import assert from 'node:assert/strict'
import test from 'node:test'
import { aiSafetySubmissionSchema, type AiSafetyRecord, type AiSafetySubmission } from '../lib/civic/ai-safety.ts'
import { AiSafetyStoreError, makeAiSafetyRecord, safetyInbox, safetyIntakeStatus, submitSafetyConcern, verifyAiSafetyRecord, type AiSafetyContext, type AiSafetyStore } from '../lib/civic/ai-safety-service.ts'

export const safetyFixture: AiSafetySubmission = {
  submissionId: '6cb97fb0-a2bc-4ff3-bf15-2b578f012401', topic: 'loss-of-control', basis: 'concern',
  concern: 'Synthetic concern: autonomous systems might act beyond their approved scope.',
  requestedAction: 'Investigate how permission boundaries can be tested independently.',
  sourceUrls: [], consentToPrivateReview: true,
}
const now = new Date('2026-10-08T00:00:00.000Z')
const token = 'synthetic-test-token-not-a-real-secret-0000'
function harness() {
  const rows = new Map<string, AiSafetyRecord>(), hashes: string[] = []
  const store: AiSafetyStore = {
    ready: async () => true,
    async submit(record, hash) {
      hashes.push(hash)
      const existing = rows.get(record.receipt.id)
      if (existing && existing.receipt.submissionDigest !== record.receipt.submissionDigest) throw new AiSafetyStoreError('conflict')
      if (!existing) rows.set(record.receipt.id, record)
      return existing ?? record
    },
    list: async () => [...rows.values()],
    async review(input) {
      const record = rows.get(input.id)
      if (!record) return null
      const reviewed = { ...record, status: input.status, review: { reviewedAt: now.toISOString(), note: input.note } }
      rows.set(input.id, reviewed)
      return reviewed
    },
  }
  const context: AiSafetyContext = { store, enabled: true, secret: token, operatorToken: token, now, trustedVercelProxy: true }
  return { context, rows, hashes }
}
const request = (body: unknown = safetyFixture, headers: Record<string, string> = {}) => new Request('https://example.test/api/civic/ai-safety', {
  method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})

test('safety receipt binds a detached immutable submission without certifying a concern', () => {
  const input = structuredClone(safetyFixture), record = makeAiSafetyRecord(input, now)
  assert.deepEqual(verifyAiSafetyRecord(record), record)
  assert.ok(Object.isFrozen(record.submission.sourceUrls))
  input.concern = 'An unrelated changed statement with enough characters.'
  assert.notEqual(input.concern, record.submission.concern)
  assert.throws(() => verifyAiSafetyRecord({ ...record, submission: input }), /Invalid private receipt/)
  assert.throws(() => verifyAiSafetyRecord({ ...record, receipt: { ...record.receipt, receivedAt: '2026-10-09T00:00:00Z' } }), /Invalid private receipt/)
  assert.throws(() => verifyAiSafetyRecord({ ...record, status: 'reviewed' }), /Invalid private receipt/)
})

test('concerns require consent, bounded text and safe links, but not technical evidence', () => {
  assert.ok(aiSafetySubmissionSchema.safeParse(safetyFixture).success)
  for (const patch of [{ consentToPrivateReview: false }, { concern: 'short' }, { requestedAction: 'x'.repeat(1501) },
    { sourceUrls: ['javascript:alert(1)'] }, { sourceUrls: ['https://user:password@example.test'] },
    { sourceUrls: Array(4).fill('https://example.test') }, { politicalAffiliation: 'anything' }, { status: 'verified' }]) {
    assert.equal(aiSafetySubmissionSchema.safeParse({ ...safetyFixture, ...patch }).success, false)
  }
})

test('intake is unavailable before storage, secrets, operator access and enablement are ready', async () => {
  const { context } = harness()
  for (const patch of [{ store: null }, { enabled: false }, { secret: '' }, { operatorToken: '' }]) {
    const configured = { ...context, ...patch }, req = request()
    assert.equal((await (await safetyIntakeStatus(configured)).json()).accepting, false)
    assert.equal((await submitSafetyConcern(req, configured)).status, 503)
    assert.equal(req.bodyUsed, false)
  }
  context.store!.ready = async () => false
  assert.equal((await (await safetyIntakeStatus(context)).json()).accepting, false)
})

test('intake acknowledges only a stored receipt and retries preserve the first acknowledgment', async () => {
  const { context, rows, hashes } = harness()
  const first = await submitSafetyConcern(request(), context), body = await first.json()
  assert.equal(first.status, 201); assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.equal(body.status, 'received'); assert.equal(rows.size, 1)
  assert.equal(body.submission, undefined)
  const again = await submitSafetyConcern(request(), { ...context, now: new Date('2026-10-08T01:00:00Z') })
  assert.deepEqual((await again.json()).receipt, body.receipt)
  assert.equal(rows.size, 1); assert.match(hashes[0], /^[a-f0-9]{64}$/)
  assert.equal((await submitSafetyConcern(request({ ...safetyFixture, concern: 'A different synthetic concern with the same submission ID.' }), context)).status, 409)
})

test('intake rejects cross-site, missing-origin, malformed, oversized and unsupported bodies without storage', async () => {
  const { context, rows } = harness()
  assert.equal((await submitSafetyConcern(request(safetyFixture, { origin: 'https://elsewhere.test' }), context)).status, 403)
  const missing = request(); missing.headers.delete('origin')
  assert.equal((await submitSafetyConcern(missing, context)).status, 403)
  assert.equal((await submitSafetyConcern(request(safetyFixture, { 'content-type': 'text/plain' }), context)).status, 415)
  assert.equal((await submitSafetyConcern(request({ ...safetyFixture, concern: 'x'.repeat(25000) }), context)).status, 413)
  const malformed = new Request('https://example.test/api/civic/ai-safety', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: '{' })
  assert.equal((await submitSafetyConcern(malformed, context)).status, 400)
  assert.equal(rows.size, 0)
})

test('quota and storage failures never produce a success or expose internal diagnostics', async () => {
  const { context } = harness()
  for (const [error, code] of [[new AiSafetyStoreError('rate-limited'), 429], [new Error('private database credentials'), 503]] as const) {
    context.store!.submit = async () => { throw error }
    const response = await submitSafetyConcern(request(), context)
    assert.equal(response.status, code)
    assert.doesNotMatch(await response.text(), /private database credentials/)
  }
  context.store!.submit = async record => ({ ...record, receipt: { ...record.receipt, digest: '0'.repeat(64) } })
  assert.equal((await submitSafetyConcern(request(), context)).status, 503)
})

test('rate identifiers rotate daily and ignore untrusted generic forwarding headers', async () => {
  const { context, hashes } = harness()
  await submitSafetyConcern(request(safetyFixture, { 'x-forwarded-for': '1.1.1.1' }), context)
  await submitSafetyConcern(request(safetyFixture, { 'x-forwarded-for': '2.2.2.2' }), context)
  assert.equal(hashes[0], hashes[1])
  await submitSafetyConcern(request(safetyFixture, { 'x-vercel-forwarded-for': '1.1.1.1' }), context)
  assert.notEqual(hashes[1], hashes[2])
  await submitSafetyConcern(request(safetyFixture, { 'x-vercel-forwarded-for': '1.1.1.1' }), { ...context, now: new Date('2026-10-09T00:00:00Z') })
  assert.notEqual(hashes[2], hashes[3])
})

test('private inbox requires operator authorization before reading bodies or listing records', async () => {
  const { context, rows } = harness()
  await submitSafetyConcern(request(), context)
  for (const headers of [{}, { authorization: 'Bearer not-valid' }] as Record<string, string>[]) {
    const req = request(safetyFixture, headers)
    assert.equal((await safetyInbox(req, context)).status, 401)
    assert.equal(req.bodyUsed, false)
  }
  const read = () => new Request('https://example.test/api/admin/civic-ai-safety', { headers: { authorization: `Bearer ${token}` } })
  const response = await safetyInbox(read(), context)
  assert.equal((await response.json()).records.length, 1)
  for (const query of ['?before=', '?before=invalid', '?unknown=1']) {
    const invalidRead = new Request(`https://example.test/api/admin/civic-ai-safety${query}`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal((await safetyInbox(invalidRead, context)).status, 400)
  }
  const reviewRequest = request({ id: safetyFixture.submissionId, status: 'needs-research', note: 'Review the available evidence before drawing a conclusion.' }, { authorization: `Bearer ${token}` })
  assert.equal((await safetyInbox(reviewRequest, context)).status, 200)
  assert.equal(rows.get(safetyFixture.submissionId)?.status, 'needs-research')
  assert.equal(rows.get(safetyFixture.submissionId)?.receipt.digest, makeAiSafetyRecord(safetyFixture, now).receipt.digest)
  const invalid = request({ id: safetyFixture.submissionId, status: 'verified', note: 'Unsupported verdict.' }, { authorization: `Bearer ${token}` })
  assert.equal((await safetyInbox(invalid, context)).status, 400)
})
