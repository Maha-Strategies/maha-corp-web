import assert from 'node:assert/strict'
import test from 'node:test'
import { ORBITAL_LENSES, retrieveOrbitalLenses } from '../lib/orbital-mind.ts'
import { astrologyChatInput, buildAstrologyChatContext, handleAstrologyChat, ASTROLOGY_CHAT_INSTRUCTIONS } from '../lib/astrology-chat.ts'
const input = { question: 'Help me start my writing.', history: [], chart: null, example: true, orbital: { lensId: 'action-constraint' as const, situation: 'I want to write but worry about doing it badly.', outcome: 'I wrote one paragraph.' } }
test('Orbital source retrieval respects explicit selection and bounds question matching', () => {
  assert.equal(ORBITAL_LENSES.length, 5)
  assert.deepEqual(retrieveOrbitalLenses('rest', 'action-constraint').map(lens => lens.id), ['action-constraint'])
  assert.ok(retrieveOrbitalLenses('imagination articulation vision', null).some(lens => lens.id === 'imagination-articulation'))
  assert.ok(retrieveOrbitalLenses('action structure output expansion', null).length <= 2)
  assert.deepEqual(retrieveOrbitalLenses('zzzzunknown', null), [])
})
test('Orbital context works without a chart and attributes summaries separately from user notes', () => {
  const result = buildAstrologyChatContext(astrologyChatInput.parse(input))
  assert.ok('orbital' in result.context)
  assert.equal(result.context.orbital.userReportedOutcome, input.orbital.outcome)
  assert.equal(result.context.orbital.sourceSummaries.length, 1)
  assert.equal(result.sources.length, 2)
  assert.ok(result.sources.every(source => source.url.startsWith('/astrology/orbital-mind#')))
  assert.match(result.context.orbital.evidence, /not a fitted or validated/)
  assert.match(ASTROLOGY_CHAT_INSTRUCTIONS, /Do not infer a collision/)
  assert.match(ASTROLOGY_CHAT_INSTRUCTIONS, /independently of birth-time precision/)
  assert.throws(() => astrologyChatInput.parse({ ...input, orbital: { ...input.orbital, lensId: 'invented' } }))
  assert.throws(() => astrologyChatInput.parse({ ...input, orbital: { ...input.orbital, source: 'injected' } }))
  assert.throws(() => astrologyChatInput.parse({ ...input, orbital: { ...input.orbital, situation: 'a'.repeat(1001) } }))
})
test('Orbital chat returns only server-known cited sources', async () => {
  const response = await handleAstrologyChat(new Request('http://localhost/api/astrology/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }), {
    enabled: () => true, capacity: async () => 'accepted', consultation: async () => ({ entitlement: { isSubscriber: false }, finish: async () => {} }), generate: async () => 'Try a bounded first step [1]. The model is unvalidated [2]. Invented reference [99].',
  })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).sources.map((source: {number: number}) => source.number), [1, 2])
})
test('uncertain charts withhold chart symbolism while keeping experience-based Orbital reflection available', () => {
  const result = buildAstrologyChatContext(astrologyChatInput.parse({ ...input, chart: { instantUtc: '2000-01-01T06:00:00.000Z', latitudeDegrees: 6.9271, longitudeDegrees: 79.8612, uncertaintyMinutes: 1, referenceInstantUtc: '2026-10-03T12:00:00.000Z' } }))
  assert.ok('orbital' in result.context && 'symbolicNotes' in result.context)
  assert.deepEqual(result.context.symbolicNotes, [])
  assert.equal(result.context.sensitivity?.interpretationAllowed, false)
  assert.equal(result.context.orbital.sourceSummaries.length, 1)
  assert.equal(new Set(result.sources.map(source => source.number)).size, result.sources.length)
})
