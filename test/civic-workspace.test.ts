import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import { makeAiSafetyRecord } from '../lib/civic/ai-safety-service.ts'
import { changeConsultation, changeSafetyCase, citizenCaseView, initialSafetyCase, validateSafetyCase } from '../lib/civic/workspace-engine.ts'
import { handleCitizenCase, handlePublicParticipation, handleWorkspaceAdmin, type WorkspaceRow, type WorkspaceStore } from '../lib/civic/workspace-service.ts'
import { consultationPacketSchema, riskGraphSchema, type Consultation, type SafetyCase } from '../lib/civic/workspace-types.ts'
import { civicDigest } from '../lib/civic/receipt.ts'

const now = new Date('2026-10-08T12:00:00Z'), key = 'a'.repeat(64), token = 'synthetic-operator-token-for-unit-tests-only'
const initial = () => initialSafetyCase(makeAiSafetyRecord({ submissionId: randomUUID(), topic: 'oversight', basis: 'observation',
  concern: 'Synthetic concern about a tool operating outside its permitted scope.', requestedAction: 'Investigate whether the expected approval was enforced.', sourceUrls: ['https://example.test/source'], consentToPrivateReview: true }, now))
const command = (state: SafetyCase) => ({ id: state.id, expectedRevision: state.revision, operationId: randomUUID() })
const summary = () => ({ id: randomUUID(), title: 'Synthetic investigation summary', youRaised: 'A synthetic permission-boundary concern was raised.',
  weInvestigated: 'The operator inspected a synthetic fixture and its limits.', whatChanged: 'A synthetic test was added; no real incident is alleged.', unresolved: ['Whether this pattern appears in deployed systems is unknown.'], decisionRationale: 'Further independent evidence is needed before substantive conclusions.', sources: [] })
const update = (state: SafetyCase) => ({ ...command(state), action: 'update' as const, assignedReviewer: 'Reviewer A', nextAction: 'Inspect the source and reproduce the boundary test.', dueOn: '2026-10-12', status: 'awaiting-citizen' as const,
  privateNote: 'SYNTHETIC_INTERNAL_ONLY_NOTE', citizenUpdate: 'The reviewer is checking the supplied source.', clarificationRequest: 'Which version of the synthetic test was used?', graph: state.graph })
const packet = () => consultationPacketSchema.parse({ title: 'Synthetic consultation', question: 'Which testing approach should be investigated?', scope: 'Synthetic alternatives for a unit test, without factual policy claims.', opensAt: '2026-10-08T00:00:00Z', closesAt: '2026-11-08T00:00:00Z',
  alternatives: ['baseline', 'testing'].map(id => ({ id, title: `${id} alternative`, description: 'A synthetic alternative described for comparison.', benefits: ['Possible evidence benefit'], tradeoffs: ['Unmeasured testing cost'] })),
  evidence: [{ citation: 'Synthetic source pointer', url: 'https://example.test/source', publishedOn: null, checkedOn: null, contentDigest: null, verification: 'unreviewed-pointer' }], questions: ['Which assumptions require evidence?'], decisionCriteria: ['Evidence quality and implementation feasibility'] })

test('new citizen observations remain unassessed and source pointers do not automatically support a claim', () => {
  const state = initial()
  assert.equal(state.graph.classification, 'unassessed'); assert.equal(state.graph.edges[0].relation, 'suggested-source')
  assert.equal(state.graph.nodes[1].source?.verification, 'unreviewed-pointer')
  assert.ok(Object.isFrozen(validateSafetyCase(state).graph))
  assert.equal(riskGraphSchema.safeParse({ ...state.graph, edges: [{ from: 'missing', to: 'concern', relation: 'supports', rationale: 'Invalid endpoint' }] }).success, false)
  assert.equal(riskGraphSchema.safeParse({ ...state.graph, nodes: [...state.graph.nodes, state.graph.nodes[0]] }).success, false)
})
test('operator assignment, internal notes and clarification have separate citizen visibility', () => {
  const state = initial(), next = changeSafetyCase(state, update(state), 'operator', now)
  assert.equal(next.assignedReviewer, 'Reviewer A'); assert.equal(next.messages.length, 3)
  assert.doesNotMatch(JSON.stringify(citizenCaseView(next)), /SYNTHETIC_INTERNAL_ONLY_NOTE/)
  const replied = changeSafetyCase(next, { ...command(next), action: 'reply', text: 'The synthetic test used version one.' }, 'citizen', now)
  assert.equal(replied.status, 'investigating'); assert.equal(replied.clarificationRequest, null)
  assert.throws(() => changeSafetyCase(next, { ...update(next), expectedRevision: 1 }, 'operator'), /changed/)
  assert.throws(() => changeSafetyCase(next, update(next), 'citizen'))
})
test('public summaries require exact-draft citizen consent and a human privacy review', () => {
  let state = initial()
  state = changeSafetyCase(state, { ...command(state), action: 'draft-publication', draft: summary(), privacyReviewed: true, privacyReviewer: 'Reviewer A' }, 'operator', now)
  assert.throws(() => changeSafetyCase(state, { ...command(state), action: 'publish' }, 'operator'), /consent/)
  assert.throws(() => changeSafetyCase(state, { ...command(state), action: 'approve-publication', draftDigest: '0'.repeat(64) }, 'citizen'), /changed/)
  state = changeSafetyCase(state, { ...command(state), action: 'approve-publication', draftDigest: state.publication!.digest }, 'citizen', now)
  state = changeSafetyCase(state, { ...command(state), action: 'publish' }, 'operator', now)
  assert.ok(state.publication?.publishedAt)
  const changed = changeSafetyCase(state, { ...command(state), action: 'draft-publication', draft: { ...state.publication!.draft, whatChanged: 'A revised summary requires fresh approval.' }, privacyReviewed: true, privacyReviewer: 'Reviewer A' }, 'operator', now)
  assert.equal(changed.publication!.consentedDigest, null); assert.equal(changed.publication!.publishedAt, null)
  const revoked = changeSafetyCase(state, { ...command(state), action: 'revoke-publication' }, 'citizen', now)
  assert.equal(revoked.publication!.publishedAt, null)
  const corrected = changeSafetyCase(state, { ...command(state), action: 'correct', concern: 'A corrected synthetic concern with new details.', requestedAction: 'Review the corrected version before proceeding.' }, 'citizen', now)
  assert.equal(corrected.publication, null); assert.equal(corrected.graph.classification, 'unassessed'); assert.deepEqual(corrected.receipt, state.receipt)
})
test('withdrawal removes current content, graph, notes and publication while preserving a minimal private tombstone', () => {
  let state = initial(); state = changeSafetyCase(state, update(state), 'operator', now)
  const withdrawn = changeSafetyCase(state, { ...command(state), action: 'withdraw', confirm: true }, 'citizen', now)
  assert.equal(withdrawn.submission, null); assert.equal(withdrawn.messages.length, 0); assert.equal(withdrawn.graph.nodes.length, 0)
  assert.equal(withdrawn.publication, null); assert.equal(withdrawn.status, 'withdrawn')
  assert.doesNotMatch(JSON.stringify(withdrawn), /SYNTHETIC_INTERNAL_ONLY_NOTE|Synthetic concern about a tool/)
  assert.throws(() => changeSafetyCase(withdrawn, { ...command(withdrawn), action: 'correct', concern: 'An attempt to restore removed content.', requestedAction: 'Restore this withdrawn concern.' }, 'citizen'), /withdrawn/)
})
test('consultations freeze published alternatives, require review and publish a closure rationale', () => {
  const id = randomUUID()
  let item = changeConsultation(null, { action: 'save-draft', id, expectedRevision: 0, operationId: randomUUID(), packet: packet() }, now)
  assert.equal(item.packetDigest, civicDigest(item.packet))
  item = changeConsultation(item, { action: 'open', id, expectedRevision: item.revision, operationId: randomUUID(), privacyReviewed: true }, now)
  assert.throws(() => changeConsultation(item, { action: 'save-draft', id, expectedRevision: item.revision, operationId: randomUUID(), packet: packet() }, now), /frozen/)
  item = changeConsultation(item, { action: 'close', id, expectedRevision: item.revision, operationId: randomUUID(), privacyReviewed: true, responseRationale: 'The evidence gaps remain unresolved; further investigation is needed.' }, now)
  assert.equal(item.status, 'closed'); assert.match(item.responseRationale!, /unresolved/)
})
test('case API checks access, redacts internal notes, rejects stale updates and replays exact retries', async () => {
  let state = initial(); state = changeSafetyCase(state, update(state), 'operator', now)
  let row: WorkspaceRow<SafetyCase | Consultation> = { state, operationId: null, operationDigest: null }
  const expectedHash = createHash('sha256').update(key).digest('hex')
  const store: WorkspaceStore = {
    lookup: async (_kind, id, hash) => id === state.id && (!hash || hash === expectedHash) ? row : null,
    list: async () => [row.state], publicFeed: async () => ({ summaries: [], consultations: [] }),
    commit: async (_kind, next, revision, operationId, operationDigest) => { assert.equal(row.state.revision, revision); row = { state: next, operationId, operationDigest }; return next },
  }
  const context = { store, operatorToken: token, now }
  const req = (input: unknown, access = key) => new Request('https://example.test/api/civic/ai-safety/case', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json', authorization: `Bearer ${access}` }, body: JSON.stringify(input) })
  assert.equal((await handleCitizenCase(req({ action: 'read', id: state.id }, 'b'.repeat(64)), context)).status, 404)
  const read = await handleCitizenCase(req({ action: 'read', id: state.id }), context)
  assert.doesNotMatch(await read.text(), /SYNTHETIC_INTERNAL_ONLY_NOTE/)
  const action = { ...command(state), action: 'reply', text: 'This synthetic response provides the requested version.' }
  const first = await handleCitizenCase(req(action), context); assert.equal(first.status, 200)
  assert.equal((await handleCitizenCase(req(action), context)).status, 200)
  assert.equal((await handleCitizenCase(req({ ...action, text: 'An altered reply using the same operation ID.' }), context)).status, 409)
  const unauthorized = new Request('https://example.test/api/admin/civic-workbench', { method: 'POST', body: '{}' })
  assert.equal((await handleWorkspaceAdmin(unauthorized, context)).status, 401); assert.equal(unauthorized.bodyUsed, false)
  const projection = await handlePublicParticipation(context); assert.equal(projection.status, 200)
  assert.doesNotMatch(await projection.text(), new RegExp(state.id))
})
