import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyEpistemicReleaseConflict } from '../lib/epistemic-release-conflict.ts'

test('release conflicts are reduced to bounded operational codes', () => {
  const cases = [
    ['Canonical release must bind the latest frozen target.', 'latest-target-mismatch'],
    ['Released content differs from the frozen review target.', 'released-content-mismatch'],
    ['Released identity differs from the frozen review target.', 'released-identity-mismatch'],
    ['The frozen target retains a non-release blocker: x', 'frozen-target-blocker'],
    ['Canonical publication controls or path are invalid.', 'canonical-controls-invalid'],
    ['Required scope x lacks an exact unqualified approval.', 'required-approval-missing'],
    ['Release approval manifest does not match the latest x review.', 'approval-manifest-mismatch'],
    ['Canonical record does not embed the exact x approval.', 'embedded-approval-mismatch'],
    ['Release approval manifest must contain every required scope exactly once.', 'approval-count-mismatch'],
    ['A new canonical version must explicitly supersede the active release with a new target.', 'active-lineage-conflict'],
    ['An initial release cannot declare a superseded release.', 'initial-lineage-conflict'],
    ['duplicate key value violates unique constraint', 'unique-release-conflict'],
  ] as const
  for (const [message, expected] of cases) {
    assert.equal(classifyEpistemicReleaseConflict(new Error(`failed [P0001]: ${message}`)), expected)
  }
})

test('unknown persistence detail remains opaque', () => {
  assert.equal(classifyEpistemicReleaseConflict(new Error('sensitive database detail')), 'unclassified-release-conflict')
})
