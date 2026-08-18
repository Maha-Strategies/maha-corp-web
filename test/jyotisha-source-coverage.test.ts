import assert from 'node:assert/strict'
import test from 'node:test'

import { ASTROLOGY_RULES, ASTROLOGY_TRADITIONS, JYOTISHA_COVERAGE_AREAS, getRulesForTradition } from '../lib/astrology-traditions.ts'
import { BLOCKED_TECHNIQUES } from '../lib/interpretation-compiler.ts'
import { buildJyotishaSourceCoverage } from '../lib/jyotisha-source-coverage.ts'
import { PRACTITIONER_REVIEW_RUBRIC_VERSION, PRACTITIONER_REVIEW_VERSION, assessRulePublicationReview, type PractitionerReviewRecord } from '../lib/practitioner-review.ts'

function acceptedReview(requirement: ReturnType<typeof assessRulePublicationReview>['requirements'][number], sequence: number, supersedesReviewId: string | null = null, verdict: PractitionerReviewRecord['verdict'] = 'accepted'): PractitionerReviewRecord {
  return {
    schemaVersion: PRACTITIONER_REVIEW_VERSION,
    rubricVersion: PRACTITIONER_REVIEW_RUBRIC_VERSION,
    reviewId: `prreview_${sequence.toString(16).padStart(32, '0')}`,
    scope: requirement.scope,
    targetType: requirement.scope === 'source-fidelity' ? 'source-passage' : 'interpretation-rule',
    targetId: requirement.targetId,
    targetVersion: requirement.targetVersion,
    targetSha256: requirement.targetSha256,
    reviewer: { reviewerId: 'practitioner_source_coverage', profileVersion: 1, displayName: 'Source Coverage Reviewer', qualifications: 'Qualified to review the named source and formalization scope.', affiliation: null, identityUrl: null, conflicts: [], qualifiedForScope: true },
    criteria: [], disagreements: [], rationale: 'Fixture verdict for digest-bound publication-gate testing.',
    supersedesReviewId, verdict, reviewedAtUtc: `2026-08-17T12:${sequence.toString().padStart(2, '0')}:00.000Z`, recordSha256: `sha256:${sequence.toString(16).padStart(64, '0')}`,
  }
}

test('the source-bound Jyotisha corpus stays within the declared 100–250-rule scope', () => {
  const coverage = buildJyotishaSourceCoverage()
  assert.deepEqual(coverage.areas.map((area) => area.area), [...JYOTISHA_COVERAGE_AREAS])
  const total = coverage.areas.reduce((sum, area) => sum + area.rules.length, 0)
  assert.equal(total, 101)
  assert.ok(total >= 100 && total <= 250)
  for (const area of coverage.areas) {
    assert.ok(area.rules.length > 0, area.area)
    assert.equal(area.status, 'encoded-awaiting-practitioner-review')
    for (const rule of area.rules) {
      assert.equal(rule.rightsCleared, true, rule.ruleId)
      assert.ok(rule.reviewRequirements.some((requirement) => requirement.scope === 'source-fidelity'))
      assert.ok(rule.reviewRequirements.some((requirement) => requirement.scope === 'rule-formalization'))
    }
  }
})

test('the classical expansion is atomized into auditable rule families', () => {
  const rules = ASTROLOGY_RULES.filter((rule) => rule.traditionId === 'vedic-jyotisha' && rule.sourceBoundCoverage)
  const count = (technique: string) => rules.filter((rule) => rule.technique === technique).length

  assert.equal(count('nakshatra class taxonomy'), 27)
  assert.equal(count('tithi group taxonomy'), 15)
  assert.equal(count('karaṇa lord taxonomy'), 7)
  assert.equal(count('fixed karaṇa taxonomy'), 4)
  assert.equal(count('natal nakshatra interpretation'), 27)
  assert.equal(count('avocation source mapping'), 7)
  assert.equal(count('nakshatra activity doctrine'), 5)
  assert.equal(count('grooming election doctrine'), 1)
  assert.equal(count('ritual election doctrine'), 1)
})

test('compound source lists preserve conflicts and normalize calculator names explicitly', () => {
  const hasta = ASTROLOGY_RULES.find((rule) => rule.id === 'bs-nakshatra-class-hasta')!
  assert.deepEqual(hasta.passageIds, ['bs-98-9-laghu-list', 'bs-98-11-moving-list'])
  assert.match(hasta.interpretation, /Laghu.*moving/)
  assert.match(hasta.disagreements.join(' '), /both classifications/i)

  const fifteenth = ASTROLOGY_RULES.find((rule) => rule.id === 'bs-tithi-class-15')!
  assert.deepEqual(fifteenth.conditions[0].requiresLimb?.anyOf, ['Pūrṇimā', 'Amāvāsyā'])
  const satabhisha = ASTROLOGY_RULES.find((rule) => rule.id === 'bj-natal-satabhishak-moon')!
  assert.deepEqual(satabhisha.conditions[0].requiresLimb?.anyOf, ['Śatabhiṣā'])
})

test('sensitive natal and avocation doctrine remains blocked independently of review', () => {
  const sensitive = ASTROLOGY_RULES.filter((rule) => ['natal nakshatra interpretation', 'avocation source mapping'].includes(rule.technique))
  assert.equal(sensitive.length, 34)
  for (const rule of sensitive) {
    assert.match(rule.boundary, /prohibited from generated reports/i)
    assert.ok(BLOCKED_TECHNIQUES[rule.technique], `${rule.technique} needs an independent compiler block`)
  }
})

test('mundane doctrine and the modern corporate synthesis are not collapsed', () => {
  const area = buildJyotishaSourceCoverage().areas.find((candidate) => candidate.area === 'mundane-corporate-charts')!
  assert.equal(area.rules.length, 2)
  const mundane = area.rules.find((rule) => rule.chartTypes.includes('mundane'))!
  const corporate = area.rules.find((rule) => rule.chartTypes.includes('corporate'))!
  assert.equal(mundane.doctrineStatus, 'historical-doctrine')
  assert.equal(corporate.doctrineStatus, 'maha-synthesis')
  const corporateRule = ASTROLOGY_RULES.find((rule) => rule.id === corporate.ruleId)!
  assert.equal(corporateRule.provenance, 'maha-inference')
  assert.match(corporateRule.disagreements.join(' '), /does not mention corporations/)
})

test('accepted passage and formalization reviews open only the matching frozen rule gate', () => {
  const ruleId = 'bj-musala-asraya-yoga'
  const pending = assessRulePublicationReview(ruleId, [])
  assert.equal(pending.status, 'awaiting-review')
  const reviews = pending.requirements.map((requirement, index) => acceptedReview(requirement, index + 1))
  assert.equal(assessRulePublicationReview(ruleId, reviews).status, 'accepted')

  const prior = reviews[0]
  const replacement = acceptedReview(pending.requirements[0], 99, prior.reviewId, 'revision-required')
  assert.equal(assessRulePublicationReview(ruleId, [...reviews, replacement]).status, 'revision-required')
})

test('horary and western sidereal remain intentionally empty for their stated source reasons', () => {
  const horary = ASTROLOGY_TRADITIONS.find((tradition) => tradition.id === 'horary-lilly')!
  const sidereal = ASTROLOGY_TRADITIONS.find((tradition) => tradition.id === 'western-sidereal')!
  assert.equal(getRulesForTradition(horary.id).length, 0)
  assert.match(horary.unpopulatedReason!, /unproofread OCR/)
  assert.equal(getRulesForTradition(sidereal.id).length, 0)
  assert.match(sidereal.unpopulatedReason!, /in copyright/)
  assert.match(sidereal.unpopulatedReason!, /licence/)
})
