import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { dependencyGapIsGenuine } from '../lib/federation/contract-repair.ts'

const F = 'content/federation'
const read = (n: string) => JSON.parse(readFileSync(`${F}/${n}`, 'utf8'))
const v2 = read('federation-route-candidates-v2.json')
const v3 = read('federation-route-candidates-v3.json')
const lineage = read('federation-candidate-lineage-v3.json')

type C = { candidateId: string; siteId: string; conceptId: string; routeRole: string; addedIn?: string
  conceptAuthority: { canonicalOwner: string; role: string }; evidencePlan: Record<string, string>
  rank: number | null; tranche: number | null }

const added = (v3.candidates as C[]).filter((c) => c.addedIn === 'v3')

test('v2 is retained unchanged', () => {
  // Its digest is bound into every tranche artifact including Tranches 1-12.
  // Editing it to add definitions would invalidate those bindings.
  assert.equal(v2.candidates.length, 1628)
  assert.equal(lineage.counts.retainedCandidates, v2.candidates.length)
  assert.equal(lineage.counts.supersededCandidates, 0)
  const v2Ids = new Set((v2.candidates as C[]).map((c) => c.candidateId))
  for (const c of v2.candidates as C[]) {
    assert.ok(v2Ids.has(c.candidateId))
    assert.notEqual(c.addedIn, 'v3', 'a v3 addition appears in v2')
  }
})

test('v3 is v2 plus the additions, and nothing else', () => {
  assert.equal(v3.candidates.length, v2.candidates.length + added.length)
  const v2Ids = new Set((v2.candidates as C[]).map((c) => c.candidateId))
  const carried = (v3.candidates as C[]).filter((c) => c.addedIn !== 'v3')
  assert.equal(carried.length, v2.candidates.length)
  for (const c of carried) assert.ok(v2Ids.has(c.candidateId), `${c.candidateId} is in v3 but not v2`)
})

test('every addition fills a gap that was actually reported', () => {
  // Not a wishlist. Each concept was named as a missing prerequisite by a
  // dependent already in the map.
  const reported = new Set<string>()
  for (const t of ['13', '14', '15', '16', '17']) {
    const deps = read(`federation-tranche-${t}-dependency-validation-v1.json`) as
      { dependencies: { conceptId: string; declaredOwner: string; state: string }[] }
    for (const d of deps.dependencies) {
      if (d.state === 'missing') reported.add(`${d.conceptId}|${d.declaredOwner}`)
    }
  }
  for (const c of added) {
    assert.ok(reported.has(`${c.conceptId}|${c.conceptAuthority.canonicalOwner}`),
      `${c.conceptId} was added but never reported missing`)
  }
})

test('no addition duplicates a definition v2 already had', () => {
  // A concept whose definition exists but is unreviewed is awaiting review, not
  // absent. Adding a second definition for it would create the duplication the
  // whole programme screens for.
  for (const c of added) {
    const existing = (v2.candidates as C[]).filter(
      (o) => o.conceptId === c.conceptId && o.routeRole === 'definition'
        && o.siteId === c.conceptAuthority.canonicalOwner)
    assert.deepEqual(existing.map((o) => o.candidateId), [],
      `${c.conceptId} already had a definition on ${c.conceptAuthority.canonicalOwner}`)
  }
})

test('an addition is something to review, never something reviewed', () => {
  for (const c of added) {
    for (const [axis, state] of Object.entries(c.evidencePlan)) {
      assert.equal(state, 'not-started', `${c.candidateId} claims ${axis} is ${state}`)
    }
    assert.equal(c.rank, null, 'rank must be unassigned; nothing ranked these')
    assert.equal(c.tranche, null, 'tranche must be unassigned; nothing allocated these')
  }
})

test('every addition is a definition on the property that owns the concept', () => {
  for (const c of added) {
    assert.equal(c.routeRole, 'definition')
    assert.equal(c.siteId, c.conceptAuthority.canonicalOwner)
    assert.equal(c.conceptAuthority.role, 'canonical-owner')
  }
})

test('candidate ids are derived, so regeneration is reproducible', () => {
  const before = readFileSync(`${F}/federation-route-candidates-v3.json`, 'utf8')
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-federation-candidate-map-v3.ts'],
    { stdio: 'ignore' })
  assert.equal(readFileSync(`${F}/federation-route-candidates-v3.json`, 'utf8'), before)
  assert.equal(new Set(added.map((c) => c.candidateId)).size, added.length)
})

test('the lineage records what each addition unblocks', () => {
  assert.equal(lineage.addedCandidates.length, added.length)
  const total = (lineage.addedCandidates as { unlocksDependents: number }[])
    .reduce((n, a) => n + a.unlocksDependents, 0)
  assert.equal(total, lineage.counts.dependentsUnblocked)
  for (const a of lineage.addedCandidates as { candidateObjectDigest: string }[]) {
    assert.match(a.candidateObjectDigest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('no tranche has been re-run against v3', () => {
  // The additions are unreviewed. A tranche artifact citing v3 would mean 32
  // candidates entered a cohort without review.
  for (const t of ['13', '14', '15', '16', '17']) {
    const cohort = read(`federation-tranche-${t}-cohort-v1.json`) as { candidateMapDigest?: string }
    const ids = new Set((read(`federation-tranche-${t}-cohort-v1.json`).entries as C[]).map((c) => c.candidateId))
    for (const c of added) {
      assert.ok(!ids.has(c.candidateId), `${c.candidateId} was added in v3 and already appears in Tranche ${t}`)
    }
    assert.ok(cohort.candidateMapDigest, 'each cohort must still record the map digest it was built from')
  }
})

test('a gap is genuine only when no definition exists on the declared owner', () => {
  // Tested on a constructed case, because the real data contains no
  // counter-example: every reported gap is genuinely absent, so a behavioural
  // test over it would pass whether the rule worked or not.
  const existing = [{
    candidateId: 'cand_x', siteId: 'maha-research', routeRole: 'definition',
    conceptId: 'urn:maha:concept:evidence:already-defined',
    conceptAuthority: { canonicalOwner: 'maha-research', role: 'owner-application', boundary: '' },
  }]
  assert.equal(dependencyGapIsGenuine('urn:maha:concept:evidence:already-defined', 'maha-research', existing), false)
  assert.equal(dependencyGapIsGenuine('urn:maha:concept:evidence:nowhere', 'maha-research', existing), true)
  // A definition on a different property does not fill the gap on this one.
  assert.equal(dependencyGapIsGenuine('urn:maha:concept:evidence:already-defined', 'maha-policy', existing), true)
})

test('every v3 addition passes the genuine-gap rule against v2', () => {
  for (const c of added) {
    assert.equal(
      dependencyGapIsGenuine(c.conceptId, c.conceptAuthority.canonicalOwner, v2.candidates as never),
      true, `${c.conceptId} was added but v2 already defines it`)
  }
})
