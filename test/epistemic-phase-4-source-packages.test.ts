import assert from 'node:assert/strict'
import test from 'node:test'

import { EPISTEMIC_PHASE4_PILOT_ENTRIES } from '../lib/epistemic-pilot-corpus.ts'
import { EPISTEMIC_PHASE4_SOURCE_PACKAGES } from '../lib/epistemic-phase4-source-packages.ts'

test('Phase 4 operator source packages are bounded to pilot records and preserve review authority', () => {
  const pilotById = new Map(EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => [entry.recordId, entry]))
  assert.equal(EPISTEMIC_PHASE4_SOURCE_PACKAGES.length, 13)
  assert.equal(new Set(EPISTEMIC_PHASE4_SOURCE_PACKAGES.map((entry) => entry.recordId)).size, 13)
  for (const sourcePackage of EPISTEMIC_PHASE4_SOURCE_PACKAGES) {
    const pilot = pilotById.get(sourcePackage.recordId)
    assert.ok(pilot)
    assert.equal(sourcePackage.researchStatus, 'operator-researched-review-required')
    assert.ok(sourcePackage.corrections.length >= 3)
    assert.equal(new Set(sourcePackage.corrections.map((correction) => correction.blockerCode)).size, sourcePackage.corrections.length)
    for (const correction of sourcePackage.corrections) {
      assert.match(correction.sourceUrl, /^https:\/\//)
      assert.ok(correction.note.length >= 20)
      assert.match(correction.rightsBasis, /no source quotation imported/i)
      if (correction.blockerCode.startsWith('source-locator-missing:')) {
        assert.equal(correction.exactLocator, correction.proposedValue)
      } else {
        assert.equal(correction.exactLocator, null)
      }
      if (correction.blockerCode.startsWith('claim-evidence-not-assessed:')) {
        assert.equal(correction.proposedValue, 'not-applicable')
      }
    }
    assert.deepEqual(
      sourcePackage.corrections.map((correction) => correction.blockerCode).sort(),
      [...pilot.initialSourceBlockers].sort(),
      `${sourcePackage.recordId} must cover its complete initial source blocker set`,
    )
  }
})
