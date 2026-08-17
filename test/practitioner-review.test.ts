import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { GET, POST } from '../app/api/admin/practitioner-reviews/route.ts'
import {
  PRACTITIONER_REVIEW_BOUNDARY,
  buildPractitionerReviewRecord,
  buildPractitionerReviewTargets,
  deriveReviewVerdict,
  parsePractitionerReview,
} from '../lib/practitioner-review.ts'

const reviewer = {
  reviewerId: 'practitioner_anjali-rao', profileVersion: 1, displayName: 'Anjali Rao',
  qualifications: 'Practising Jyotisha consultant with documented Sanskrit-source and chart-calculation review experience.',
  affiliation: 'Independent', identityUrl: 'https://example.org/reviewers/anjali-rao', conflicts: [], qualifiedForScope: true,
}

function requestFor(target = buildPractitionerReviewTargets()[0]) {
  return {
    targetId: target.targetId, targetVersion: target.targetVersion, targetSha256: target.targetSha256, reviewer,
    criteria: target.criteria.map((criterion) => ({ criterionId: criterion.id, verdict: 'agree', rationale: `I reviewed ${criterion.label} against the frozen payload and find this specific representation faithful.` })),
    disagreements: [] as { criterionId: string; severity: 'advisory' | 'material' | 'blocking'; statement: string; proposedResolution: string | null }[], rationale: 'This verdict applies only to the named frozen target and the criteria recorded here.', supersedesReviewId: null, idempotencyKey: `review:${target.targetId}:one`,
  }
}

test('the queue exposes three separate review lanes and no product target', () => {
  const targets = buildPractitionerReviewTargets()
  assert.deepEqual(new Set(targets.map((target) => target.scope)), new Set(['calculation-conventions', 'source-fidelity', 'rule-formalization']))
  assert.equal(targets.filter((target) => target.scope === 'calculation-conventions').length, 1)
  assert.ok(targets.some((target) => target.scope === 'source-fidelity'))
  assert.ok(targets.some((target) => target.scope === 'rule-formalization'))
  assert.equal(targets.some((target) => target.targetType.includes('product') || target.targetId.includes('product')), false)
})

test('calculation review requires Lahiri, node, house, and Vimshottari judgements independently', () => {
  const target = buildPractitionerReviewTargets()[0]
  assert.deepEqual(target.criteria.map((criterion) => criterion.id), ['lahiri-ayanamsa', 'lunar-node-model', 'house-system', 'vimshottari-balance'])
  assert.equal(parsePractitionerReview(requestFor(target)).verdict, 'accepted')
  const incomplete = requestFor(target); incomplete.criteria.pop()
  assert.throws(() => parsePractitionerReview(incomplete), /exactly 4 independent criterion reviews/)
})

test('review targets are version-and-digest bound', () => {
  const input = requestFor()
  assert.throws(() => parsePractitionerReview({ ...input, targetSha256: `sha256:${'0'.repeat(64)}` }), /not in the current review registry/)
  assert.throws(() => parsePractitionerReview({ ...input, targetVersion: 'future' }), /not in the current review registry/)
})

test('verdict is derived from criterion judgements rather than supplied as product approval', () => {
  assert.equal(deriveReviewVerdict([{ criterionId: 'x', verdict: 'agree', rationale: 'x' }]), 'accepted')
  assert.equal(deriveReviewVerdict([{ criterionId: 'x', verdict: 'agree-with-reservation', rationale: 'x' }]), 'accepted-with-reservations')
  assert.equal(deriveReviewVerdict([{ criterionId: 'x', verdict: 'revise', rationale: 'x' }]), 'revision-required')
  assert.equal(deriveReviewVerdict([{ criterionId: 'x', verdict: 'disagree', rationale: 'x' }]), 'disagreed')
  assert.equal(deriveReviewVerdict([{ criterionId: 'x', verdict: 'not-qualified', rationale: 'x' }]), 'abstained')
})

test('revision and disagreement require structured disagreement evidence', () => {
  const input = requestFor()
  input.criteria[0].verdict = 'revise'
  assert.throws(() => parsePractitionerReview(input), /requires a structured disagreement/)
  input.disagreements.push({ criterionId: input.criteria[0].criterionId, severity: 'material', statement: 'The stated convention omits a material qualification needed to reproduce the reviewed method.', proposedResolution: 'Add the qualification and issue a new target version for review.' })
  assert.equal(parsePractitionerReview(input).verdict, 'revision-required')
})

test('a record preserves reviewer identity, profile version, rationale, disagreement, and target digest', () => {
  const input = requestFor()
  input.criteria[0].verdict = 'agree-with-reservation'
  input.disagreements.push({ criterionId: input.criteria[0].criterionId, severity: 'advisory', statement: 'The method is acceptable but terminology should distinguish the named convention more prominently.', proposedResolution: null })
  const record = buildPractitionerReviewRecord(parsePractitionerReview(input), new Date('2026-08-17T12:00:00.000Z'))
  assert.equal(record.reviewer.reviewerId, reviewer.reviewerId)
  assert.equal(record.reviewer.profileVersion, 1)
  assert.equal(record.verdict, 'accepted-with-reservations')
  assert.equal(record.disagreements.length, 1)
  assert.match(record.targetSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(record.recordSha256, /^sha256:[a-f0-9]{64}$/)
  assert.match(PRACTITIONER_REVIEW_BOUNDARY, /not product approval, scientific validation/)
})

test('supersession is explicit and malformed review ids are refused', () => {
  const input = requestFor()
  assert.throws(() => parsePractitionerReview({ ...input, supersedesReviewId: 'prreview_short' }), /must contain 41–41 characters/)
  const prior = `prreview_${'a'.repeat(32)}`
  assert.equal(parsePractitionerReview({ ...input, supersedesReviewId: prior }).supersedesReviewId, prior)
})

test('the API fails closed before persistence and always carries the boundary', async () => {
  const previous = process.env.PRACTITIONER_REVIEW_TOKEN
  delete process.env.PRACTITIONER_REVIEW_TOKEN
  try {
    const unauthorized = await GET(new Request('https://example.test/api/admin/practitioner-reviews'))
    assert.equal(unauthorized.status, 401)
    assert.match(await unauthorized.text(), /not product approval/)
    process.env.PRACTITIONER_REVIEW_TOKEN = 'a'.repeat(32)
    const unavailable = await GET(new Request('https://example.test/api/admin/practitioner-reviews', { headers: { authorization: `Bearer ${'a'.repeat(32)}` } }))
    assert.equal(unavailable.status, 503)
    const bad = await POST(new Request('https://example.test/api/admin/practitioner-reviews', { method: 'POST', headers: { authorization: `Bearer ${'a'.repeat(32)}`, 'content-type': 'application/json' }, body: '{}' }))
    assert.equal(bad.status, 400)
  } finally {
    if (previous === undefined) delete process.env.PRACTITIONER_REVIEW_TOKEN
    else process.env.PRACTITIONER_REVIEW_TOKEN = previous
  }
})

test('the database is append-only and cannot store product approval', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260817000200_practitioner_review_layer.sql', import.meta.url), 'utf8')
  assert.match(sql, /revoke insert, update, delete, truncate .* from service_role/)
  assert.match(sql, /scope in \('calculation-conventions','source-fidelity','rule-formalization'\)/)
  assert.match(sql, /No row represents product approval/)
  assert.doesNotMatch(sql, /approved_product|product_approval/)
})

test('the private workspace asks for scoped qualifications, criteria, disagreement, and rationale', async () => {
  const page = await readFile(new URL('../app/admin/practitioner-reviews/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /Qualifications for this scope/)
  assert.match(page, /Criterion-specific rationale/)
  assert.match(page, /Disagreements and scoped conclusion/)
  assert.match(page, /cannot approve Maha Celestial as a product/)
  assert.doesNotMatch(page, />Approve product</)
})
