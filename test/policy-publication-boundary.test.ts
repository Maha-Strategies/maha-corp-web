import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { POLICY_DRAFTS } from '../lib/policy-expansion-drafts.ts'
import { policyDraftPublished, policyDraftVisible } from '../lib/policy-expansion-types.ts'

/**
 * Eight briefs are published as an options library. Four are not, because
 * their legal or empirical baselines are out of date — one rests on archived
 * 2009 material, another on an October 2023 document. The danger is that a
 * later edit quietly promotes one of those four, or turns the library into a
 * set of attributed positions. Both are guarded here.
 */

const HELD = ['borders-asylum-immigration', 'crime-civil-liberties', 'use-of-military-force', 'china-competition-cooperation']
const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')

test('exactly eight briefs are published, and the four on evidence holds are not', () => {
  const published = POLICY_DRAFTS.filter(policyDraftPublished).map((d) => d.slug)
  const held = POLICY_DRAFTS.filter((d) => !policyDraftPublished(d)).map((d) => d.slug)
  assert.equal(published.length, 8, 'the published set changed size')
  assert.deepEqual(held.sort(), [...HELD].sort(), 'the set of withheld briefs changed')
  for (const slug of HELD) {
    assert.ok(!published.includes(slug), `${slug} must not be published while its baseline is stale`)
  }
})

test('a held brief is invisible in production and visible only for editing', () => {
  for (const draft of POLICY_DRAFTS.filter((d) => !policyDraftPublished(d))) {
    assert.equal(policyDraftVisible(draft, 'production'), false, `${draft.slug} must 404 in production`)
    assert.equal(policyDraftVisible(draft, undefined), false, `${draft.slug} must 404 when NODE_ENV is unset`)
    assert.equal(policyDraftVisible(draft, 'development'), true, `${draft.slug} should stay editable locally`)
  }
  for (const draft of POLICY_DRAFTS.filter(policyDraftPublished)) {
    assert.equal(policyDraftVisible(draft, 'production'), true, `${draft.slug} is published and must render`)
  }
})

test('publication is a property of readiness, not an environment flag', () => {
  // The original guard's comment says availability is deliberately not an
  // opt-in production feature flag. That intent is preserved: nothing about
  // publication can be changed by setting a variable.
  const types = read('lib/policy-expansion-types.ts')
  assert.match(types, /deliberately not an opt-in production feature flag/)
  const routes = read('app/policy/questions/[slug]/page.tsx') + read('app/policy/methodology/[slug]/page.tsx')
  assert.doesNotMatch(routes, /process\.env\.[A-Z_]*(FLAG|ENABLE|PUBLISH)/, 'publication must not be env-toggled')
})

test('only a published brief is indexable', () => {
  const route = read('app/policy/questions/[slug]/page.tsx')
  // A held draft keeps the noindex robots directive; a published one does not.
  assert.match(route, /published \? \{\} : \{ robots: POLICY_DRAFT_ROBOTS \}/)
})

test('the library never claims an approved position or an expert review', () => {
  const reader = read('components/policy/PolicyExpansionReader.tsx')
  assert.match(reader, /compare approaches without selecting one/i)
  assert.match(reader, /not an approved Maha position|Nothing here is an approved Maha position/i)
  // The review basis and Maha's own commercial interest must stay on the page.
  assert.match(reader, /POLICY_REVIEW_BASIS/)
  assert.match(reader, /POLICY_INTEREST_DISCLOSURE/)
})

test('publishing the library does not remove the existing doctrine page', () => {
  // The prototype swapped /policy for the entrance. That would delete
  // published doctrine and five attributed proposals from a live URL, so the
  // library got its own entrance instead and /policy links to it.
  const doctrine = read('app/policy/page.tsx')
  assert.doesNotMatch(doctrine, /PolicyExpansionEntrance/, '/policy must keep rendering its own doctrine')
  assert.match(doctrine, /\/policy\/questions/, '/policy must link to the options library')
  const entrance = read('app/policy/questions/page.tsx')
  assert.match(entrance, /PolicyExpansionEntrance/)
})
