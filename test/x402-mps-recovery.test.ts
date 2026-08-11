import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  deriveRetrievalToken,
  createRetrievalToken,
  retrievalTokenHash,
  retrievalTokenMatches,
  validRetrievalToken,
} from '../lib/x402/mps-audit-job.ts'

const SECRET = 'a-server-secret-of-at-least-32-characters'
const OTHER_SECRET = 'a-different-server-secret-32-chars-long!!'
const AUDIT_ID = `audit_${'1'.repeat(32)}`

// A paid job must survive the process that created it.
//
// The previous design minted a random retrieval token, stored only its hash,
// and returned the token *after* an Anthropic call that can take a minute. A
// timeout, crash, or instance restart in that window destroyed the only copy
// of the credential: the job was paid for, recorded, and permanently
// unreachable. The secret existed solely in the memory of a response that
// never arrived.

test('the retrieval credential is derivable, so losing the response does not lose the job', () => {
  const first = deriveRetrievalToken(AUDIT_ID, SECRET)
  const second = deriveRetrievalToken(AUDIT_ID, SECRET)

  assert.ok(first)
  // Recomputed identically, later, on any instance -- which is the whole
  // property. A random token is not recoverable by definition.
  assert.equal(first, second)
  assert.ok(validRetrievalToken(first!))
})

test('the credential is still unguessable and still bound to one job', () => {
  const token = deriveRetrievalToken(AUDIT_ID, SECRET)!
  // Derivable by the server is not the same as predictable by a caller: an
  // HMAC over a 128-bit id under a server secret is no easier to guess than
  // the random token it replaced.
  assert.notEqual(token, deriveRetrievalToken(`audit_${'2'.repeat(32)}`, SECRET))
  assert.notEqual(token, deriveRetrievalToken(AUDIT_ID, OTHER_SECRET))
  assert.equal(token.length, 'mpsrt_'.length + 43)

  // And it still verifies against the stored digest, in constant time.
  const stored = retrievalTokenHash(token)
  assert.ok(retrievalTokenMatches(token, stored))
  assert.equal(retrievalTokenMatches(deriveRetrievalToken(AUDIT_ID, OTHER_SECRET)!, stored), false)
  assert.equal(retrievalTokenMatches(createRetrievalToken(), stored), false)
})

test('a weak or missing secret is refused rather than silently degraded', () => {
  // Falling back to a random per-instance value would produce tokens that
  // cannot be verified on another instance, and would fail precisely under the
  // conditions this exists to survive.
  assert.equal(deriveRetrievalToken(AUDIT_ID, undefined), null)
  assert.equal(deriveRetrievalToken(AUDIT_ID, ''), null)
  assert.equal(deriveRetrievalToken(AUDIT_ID, 'too-short'), null)
})

test('a crash after job creation still leaves the job retrievable', () => {
  // Simulates the exact window: the row was written, then the process died
  // before the response was sent. Nothing about the credential was kept in
  // memory, so recovery is a pure function of what is on disk.
  const persistedRow = {
    public_id: AUDIT_ID,
    retrieval_token_hash: retrievalTokenHash(deriveRetrievalToken(AUDIT_ID, SECRET)!),
    status: 'processing' as const,
  }

  // A brand-new process, holding only the secret and the stored row.
  const recovered = deriveRetrievalToken(persistedRow.public_id, SECRET)
  assert.ok(recovered, 'a fresh process must be able to recompute the credential')
  assert.ok(
    retrievalTokenMatches(recovered!, persistedRow.retrieval_token_hash),
    'the recomputed credential must open the job the dead process created',
  )
})

test('recovery is re-issued on the free idempotent replay, not sold again', () => {
  // The payer-facing half of the same property. They do not need to have kept
  // the token: asking again with the same clientRequestId returns the job and
  // the credential, and the pre-settlement admission claim means that costs
  // nothing.
  const source = readFileSync(join(import.meta.dirname, '..', 'app', 'api', 'v1', 'mps', 'audit', 'route.ts'), 'utf8')

  assert.ok(
    /idempotentReplay: true, retrievalToken: deriveRetrievalToken\(job\.public_id\)/.test(source),
    'the replay branch must re-issue the derived retrieval credential',
  )
  // And the route must not be minting a random one any more.
  assert.equal(source.includes('createRetrievalToken('), false)
  assert.ok(source.includes('deriveRetrievalToken(auditId)'))
})

test('the route refuses to start a paid job it could not hand back', () => {
  // Without the secret there is no recoverable credential, so the honest
  // answer is to refuse *before* the model boundary rather than take the money
  // and produce a job nobody can open.
  const source = readFileSync(join(import.meta.dirname, '..', 'app', 'api', 'v1', 'mps', 'audit', 'route.ts'), 'utf8')
  const refusalAt = source.indexOf('retrieval_credential_unavailable')
  const insertAt = source.indexOf("from('x402_mps_audits').insert(")
  const modelAt = source.indexOf('new Anthropic(')

  assert.ok(refusalAt > 0, 'a missing secret must be handled')
  assert.ok(refusalAt < insertAt, 'the refusal must precede the job insert')
  assert.ok(insertAt < modelAt, 'the job must still be committed before the model call')
})

test('there is no fake background execution behind the offer', () => {
  // An unawaited promise on a serverless function is not durability: the
  // instance is frozen or torn down once the response is returned, so the work
  // silently never happens. Recovery here is explicit and client-driven --
  // resume at the retrieval path -- which is why it can be tested at all.
  const source = readFileSync(join(import.meta.dirname, '..', 'app', 'api', 'v1', 'mps', 'audit', 'route.ts'), 'utf8')
  assert.equal(/void\s+runMpsAudit/.test(source), false)
  assert.equal(source.includes('waitUntil'), false)
  assert.ok(source.includes('await runMpsAudit'))
})
