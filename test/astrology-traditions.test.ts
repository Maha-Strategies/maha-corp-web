import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASTROLOGY_MAX_EXCERPT_WORDS,
  ASTROLOGY_PASSAGES,
  ASTROLOGY_PROHIBITED_USES,
  ASTROLOGY_RULES,
  ASTROLOGY_SCHEMA,
  ASTROLOGY_SOURCES,
  ASTROLOGY_TRADITIONS,
  assertAstrologyIntegrity,
  buildAstrologyRegistry,
  getAstrologyPassage,
  getRulesForTradition,
  wordCount,
  type InterpretationRule,
} from '../lib/astrology-traditions.ts'
import { toMpsTag } from '../lib/claim-evidence.ts'

/** Runs `assertAstrologyIntegrity` with one extra rule appended, then removes it. */
function withRule(rule: InterpretationRule, run: () => void): void {
  ASTROLOGY_RULES.push(rule)
  try { run() } finally { ASTROLOGY_RULES.pop() }
}

const validRule: InterpretationRule = {
  id: 'test-rule', traditionId: 'hellenistic-ptolemaic', technique: 'test', chartTypes: ['natal'],
  conditions: [{ factField: 'coordinates.values', description: 'A test condition.' }],
  interpretation: 'A test interpretation long enough to satisfy the minimum length requirement.',
  passageIds: ['ptb-1-5-benefic'], provenance: 'restates-source', empirical: 'unvalidated-tradition',
  disagreements: [], boundary: 'A test boundary that is long enough to satisfy the minimum length rule.',
}

test('the baseline registry is internally consistent', () => {
  assert.doesNotThrow(() => assertAstrologyIntegrity())
  assert.ok(ASTROLOGY_RULES.length > 0)
})

test('every rule declares a tradition that exists', () => {
  const ids = new Set(ASTROLOGY_TRADITIONS.map((tradition) => tradition.id))
  for (const rule of ASTROLOGY_RULES) assert.ok(ids.has(rule.traditionId), `${rule.id} has no valid tradition`)
})

test('a rule without a valid tradition is rejected', () => {
  withRule({ ...validRule, traditionId: 'not-a-tradition' }, () => {
    assert.throws(() => assertAstrologyIntegrity(), /every rule must belong to a declared tradition/)
  })
})

test('a rule without a transcribed passage is rejected', () => {
  withRule({ ...validRule, passageIds: [] }, () => {
    assert.throws(() => assertAstrologyIntegrity(), /interpretation without a transcribed source is not a record/)
  })
})

test('a rule cannot claim empirical support', () => {
  // The cast is the point: the type forbids it, and the runtime check is the
  // backstop for data arriving from outside TypeScript.
  withRule({ ...validRule, empirical: 'established' as unknown as 'unvalidated-tradition' }, () => {
    assert.throws(() => assertAstrologyIntegrity(), /must be recorded as unvalidated-tradition/)
  })
})

test('a rule cannot claim a chart type its tradition does not practise', () => {
  withRule({ ...validRule, chartTypes: ['horary'] }, () => {
    assert.throws(() => assertAstrologyIntegrity(), /which its tradition .* does not practise/)
  })
})

test('every published rule is unvalidated tradition', () => {
  for (const rule of ASTROLOGY_RULES) assert.equal(rule.empirical, 'unvalidated-tradition', rule.id)
  assert.equal(ASTROLOGY_SCHEMA.$defs.rule.properties.empirical.const, 'unvalidated-tradition')
})

test('every rule resolves to a real, bounded, rights-cleared passage', () => {
  for (const rule of ASTROLOGY_RULES) {
    assert.ok(rule.passageIds.length > 0, rule.id)
    for (const passageId of rule.passageIds) {
      const passage = getAstrologyPassage(passageId)
      assert.ok(passage, `${rule.id} references missing passage ${passageId}`)
      assert.ok(passage.locator.trim().length > 0)
      assert.ok(wordCount(passage.excerpt) <= ASTROLOGY_MAX_EXCERPT_WORDS)
      const source = ASTROLOGY_SOURCES.find((candidate) => candidate.id === passage.sourceId)
      assert.ok(source && source.rightsStatus !== 'in-copyright', `${passage.id} must not excerpt an in-copyright source`)
    }
  }
})

test('a tradition with no rules records why', () => {
  for (const tradition of ASTROLOGY_TRADITIONS) {
    if (getRulesForTradition(tradition.id).length === 0) {
      assert.ok(tradition.unpopulatedReason, `${tradition.id} is empty without a stated reason`)
    }
  }
})

test('traditions that disagree on the zodiac frame are kept separate', () => {
  const frames = new Set(ASTROLOGY_TRADITIONS.map((tradition) => tradition.zodiac))
  assert.ok(frames.size > 1, 'the registry should record more than one zodiac frame')
})

test('the registry publishes its boundary and prohibited uses', () => {
  const registry = buildAstrologyRegistry()
  assert.match(registry.epistemicBoundary, /empirical validity is not/)
  assert.equal(registry.prohibitedUses.length, ASTROLOGY_PROHIBITED_USES.length)
  for (const use of ['medical', 'legal', 'investment']) {
    assert.ok(registry.prohibitedUses.some((entry) => entry.includes(use)), `${use} must be prohibited`)
  }
})

test('rules never map onto an MPS tag that reads as endorsement', () => {
  for (const rule of ASTROLOGY_RULES) {
    assert.equal(toMpsTag({ provenance: rule.provenance, empirical: rule.empirical }), 'BOUNDARY', rule.id)
  }
})

test('transcription differences are recorded rather than silently corrected', () => {
  const noted = ASTROLOGY_PASSAGES.filter((passage) => passage.transcriptionNote)
  assert.ok(noted.length > 0, 'at least one passage should carry a transcription note')
})
