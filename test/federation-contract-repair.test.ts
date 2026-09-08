import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  CANONICAL_OWNER_ROLE, repairApplies, repairedAuthority, summariseRepair, withRepairedContract,
  type RepairableCandidate,
} from '../lib/federation/contract-repair.ts'

const F = 'content/federation'
const map = JSON.parse(readFileSync(`${F}/federation-route-candidates-v2.json`, 'utf8')) as
  { candidates: RepairableCandidate[] }

const candidate = (over: Partial<RepairableCandidate> = {}): RepairableCandidate => ({
  candidateId: 'cand_test',
  siteId: 'maha-research',
  routeRole: 'definition',
  conceptAuthority: {
    canonicalOwner: 'maha-research',
    role: 'owner-application',
    boundary: 'This route may apply evidence; it cannot redefine or inherit the authority of its canonical owner.',
  },
  ...over,
})

test('the diagnosis holds: every definition sits on the property that owns its concept', () => {
  // This is what decides that the contract was wrong rather than the role. If a
  // definition ever appears on a property that does not own the concept, the
  // repair must not silently promote it.
  const definitions = map.candidates.filter((c) => c.routeRole === 'definition')
  assert.equal(definitions.length, 169)
  const misplaced = definitions.filter((c) => c.siteId !== c.conceptAuthority.canonicalOwner)
  assert.deepEqual(misplaced.map((c) => c.candidateId), [])
})

test('the frozen map has no canonical-owner role, which is the actual defect', () => {
  // 169 individual mistakes would be one thing; a missing word in the
  // vocabulary is another, and it is the second.
  const roles = new Set(map.candidates.map((c) => c.conceptAuthority.role))
  assert.ok(!roles.has(CANONICAL_OWNER_ROLE))
  assert.deepEqual([...roles].sort(),
    ['local-application', 'owner-application', 'source-led-religion-application'])
})

test('the repair applies to a definition on its owning property', () => {
  assert.equal(repairApplies(candidate()), true)
  assert.equal(repairedAuthority(candidate()).role, CANONICAL_OWNER_ROLE)
})

test('a definition on a property that does not own the concept is left alone', () => {
  // A different fault: there the role is wrong, not the contract. Promoting it
  // would let a page define a concept it has no authority over.
  const foreign = candidate({ siteId: 'maha-strategies' })
  assert.equal(repairApplies(foreign), false)
  assert.deepEqual(withRepairedContract(foreign), foreign)
})

test('an application route is never repaired', () => {
  for (const role of ['workflow', 'comparison', 'failure-mode', 'commercial-use']) {
    assert.equal(repairApplies(candidate({ routeRole: role })), false)
  }
})

test('the repair is idempotent', () => {
  const once = withRepairedContract(candidate())
  assert.deepEqual(withRepairedContract(once), once)
  assert.equal(repairApplies(once), false)
})

test('the corrected boundary still bounds the definition', () => {
  // A definition owning its concept is not a licence. Two limits survive: it
  // does not govern other properties, and owning a definition is not evidence.
  const boundary = repairedAuthority(candidate()).boundary
  assert.match(boundary, /does not govern how other properties apply it/)
  assert.match(boundary, /Owning a definition is not evidence for it/)
  assert.match(boundary, /requires an inspected source/)
})

test('the concept family survives into the corrected boundary', () => {
  assert.match(repairedAuthority(candidate()).boundary, /canonical definition of evidence/)
  const governance = candidate({
    siteId: 'maha-policy',
    conceptAuthority: {
      canonicalOwner: 'maha-policy', role: 'owner-application',
      boundary: 'This route may apply governance; it cannot redefine or inherit the authority of its canonical owner.',
    },
  })
  assert.match(repairedAuthority(governance).boundary, /canonical definition of governance for maha-policy/)
})

test('every tranche that applied the repair recorded it', () => {
  for (const t of ['13', '14', '15', '16', '17']) {
    const artifact = JSON.parse(
      readFileSync(`${F}/federation-tranche-${t}-contract-repair-v1.json`, 'utf8')) as
      { counts: { repaired: number; roleWrongNotContract: string[] }; frozenMapUntouched: string }
    assert.equal(artifact.counts.repaired, 169)
    assert.deepEqual(artifact.counts.roleWrongNotContract, [])
    assert.match(artifact.frozenMapUntouched, /not rewritten/)
  }
})

test('the frozen map on disk is unchanged by the repair', () => {
  // The repair is applied at review time. Rewriting the map would invalidate
  // the digest bound into every prior artifact, including Tranches 1-12.
  const definitions = map.candidates.filter((c) => c.routeRole === 'definition')
  for (const c of definitions) {
    assert.notEqual(c.conceptAuthority.role, CANONICAL_OWNER_ROLE,
      'the frozen map was rewritten; it must carry the original contract')
  }
})

test('the repair summary is derived, not asserted', () => {
  const s = summariseRepair(map.candidates)
  assert.equal(s.inspected, map.candidates.filter((c) => c.routeRole === 'definition').length)
  assert.equal(s.repaired, map.candidates.filter(repairApplies).length)
  assert.equal(Object.values(s.byProperty).reduce((a, b) => a + b, 0), s.repaired)
})
